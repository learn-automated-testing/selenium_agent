/**
 * AWS Lambda handler for Selenium MCP server.
 *
 * Runs the full MCP tool set over Streamable HTTP transport using
 * selenium-webdriver + @sparticuz/chromium (headless Chrome in Lambda).
 *
 * Exposed via Lambda Function URL — each POST to /mcp is an MCP request.
 * Uses enableJsonResponse so Lambda returns plain JSON (no SSE streaming).
 *
 * Authentication: OAuth 2.1 Authorization Code + PKCE (MCP spec compliant).
 * Also accepts static Bearer token via MCP_API_KEY for CLI/testing use.
 *
 * Screenshots saved to /tmp are auto-uploaded to S3 when
 * SCREENSHOT_S3_BUCKET is set.
 */

import chromium from '@sparticuz/chromium';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createHmac, createHash, randomBytes } from 'node:crypto';

// Configure environment before the MCP server modules are imported.
process.env.SELENIUM_HEADLESS = 'true';
process.env.SELENIUM_LAMBDA = 'true';
process.env.SELENIUM_MCP_OUTPUT_DIR = '/tmp';

// S3 client for screenshot uploads (SDK v3 is pre-installed in Lambda runtime).
const S3_BUCKET = process.env.SCREENSHOT_S3_BUCKET;
const s3 = S3_BUCKET ? new S3Client({}) : null;

// Auth configuration.
const API_KEY = process.env.MCP_API_KEY;
const LOGIN_PASSWORD = process.env.OAUTH_LOGIN_PASSWORD ?? API_KEY;
const TOKEN_SECRET = process.env.MCP_API_KEY ?? randomBytes(32).toString('hex');
const TOKEN_TTL = 3600 * 8; // 8 hours

// In-memory stores (survive warm invocations, lost on cold start).
const authCodes = new Map();           // code -> { clientId, redirectUri, codeChallenge, expiresAt }
const registeredClients = new Map();   // clientId -> { clientSecret, redirectUris }

// Resolve chromium binary once (extracts from .br on first call, cached after).
const chromiumPath = chromium.executablePath();

let createServerFn;
let contextInstance;
let TransportClass;
let ready;

async function initialize() {
  process.env.SELENIUM_CHROME_BINARY = await chromiumPath;

  const serverMod = await import('./dist/src/server.js');
  const contextMod = await import('./dist/src/context.js');
  const transportMod = await import(
    '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
  );

  createServerFn = serverMod.createServer;
  TransportClass = transportMod.WebStandardStreamableHTTPServerTransport;

  contextInstance = new contextMod.Context({
    stealth: false,
    outputMode: 'stdout',
  });
}

ready = initialize();

// ---------------------------------------------------------------------------
// OAuth helpers
// ---------------------------------------------------------------------------

function generateId(bytes = 24) {
  return randomBytes(bytes).toString('base64url');
}

/** Create a self-validating access token (HMAC-signed, survives cold starts). */
function createAccessToken(clientId) {
  const payload = Buffer.from(JSON.stringify({
    sub: clientId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL,
  })).toString('base64url');
  const sig = createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** Validate an access token — returns true if signature matches and not expired. */
function validateAccessToken(token) {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  if (sig !== expected) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

/** Verify PKCE S256 code challenge. */
function verifyPkce(codeVerifier, codeChallenge) {
  const computed = createHash('sha256').update(codeVerifier).digest('base64url');
  return computed === codeChallenge;
}

/** Check if a Bearer token is valid (OAuth token OR static API key). */
function isAuthorized(event) {
  const auth = (event.headers?.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (!auth) return false;
  if (API_KEY && auth === API_KEY) return true;
  return validateAccessToken(auth);
}

function getBaseUrl(event) {
  const domain = event.requestContext?.domainName ?? 'localhost';
  return `https://${domain}`;
}

function jsonResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body ?? '', 'base64').toString('utf-8')
    : event.body ?? '';
  // Support both JSON and form-urlencoded
  if (raw.startsWith('{')) {
    try { return JSON.parse(raw); } catch { /* fall through */ }
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

// ---------------------------------------------------------------------------
// OAuth endpoints
// ---------------------------------------------------------------------------

/** GET /.well-known/oauth-authorization-server */
function handleAuthServerMetadata(event) {
  const base = getBaseUrl(event);
  return jsonResponse(200, {
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_post'],
  });
}

/** GET /.well-known/oauth-protected-resource */
function handleProtectedResourceMetadata(event) {
  const base = getBaseUrl(event);
  return jsonResponse(200, {
    resource: `${base}/mcp`,
    authorization_servers: [base],
  });
}

/** POST /register — Dynamic Client Registration (RFC 7591). */
function handleRegister(event) {
  const body = parseBody(event);
  const clientId = generateId();
  const clientSecret = generateId(32);
  const redirectUris = body.redirect_uris ?? [];

  registeredClients.set(clientId, { clientSecret, redirectUris });

  return jsonResponse(201, {
    client_id: clientId,
    client_secret: clientSecret,
    client_name: body.client_name ?? 'MCP Client',
    redirect_uris: redirectUris,
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_post',
  });
}

/** GET /authorize — Show login form. POST /authorize — Process login. */
function handleAuthorize(event) {
  const method = event.requestContext?.http?.method ?? 'GET';
  const qs = new URLSearchParams(event.rawQueryString ?? '');

  if (method === 'GET') {
    const clientId = qs.get('client_id') ?? '';
    const redirectUri = qs.get('redirect_uri') ?? '';
    const state = qs.get('state') ?? '';
    const codeChallenge = qs.get('code_challenge') ?? '';
    const codeChallengeMethod = qs.get('code_challenge_method') ?? '';

    return {
      statusCode: 200,
      headers: { 'content-type': 'text/html' },
      body: loginPage({ clientId, redirectUri, state, codeChallenge, codeChallengeMethod }),
    };
  }

  // POST — validate login
  const body = parseBody(event);
  const password = body.password ?? '';
  const clientId = body.client_id ?? '';
  const redirectUri = body.redirect_uri ?? '';
  const state = body.state ?? '';
  const codeChallenge = body.code_challenge ?? '';

  if (password !== LOGIN_PASSWORD) {
    return {
      statusCode: 200,
      headers: { 'content-type': 'text/html' },
      body: loginPage({
        clientId, redirectUri, state, codeChallenge,
        codeChallengeMethod: body.code_challenge_method ?? '',
        error: 'Invalid password',
      }),
    };
  }

  // Generate auth code
  const code = generateId();
  authCodes.set(code, {
    clientId,
    redirectUri,
    codeChallenge,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 min
  });

  // Redirect back to client
  const redirect = new URL(redirectUri);
  redirect.searchParams.set('code', code);
  if (state) redirect.searchParams.set('state', state);

  return {
    statusCode: 302,
    headers: { location: redirect.toString() },
    body: '',
  };
}

/** POST /token — Exchange auth code for access token. */
function handleToken(event) {
  const body = parseBody(event);
  const grantType = body.grant_type;

  if (grantType !== 'authorization_code') {
    return jsonResponse(400, { error: 'unsupported_grant_type' });
  }

  const code = body.code ?? '';
  const codeVerifier = body.code_verifier ?? '';
  const clientId = body.client_id ?? '';

  const stored = authCodes.get(code);
  if (!stored) {
    return jsonResponse(400, { error: 'invalid_grant', error_description: 'Invalid or expired code' });
  }

  authCodes.delete(code);

  if (stored.expiresAt < Date.now()) {
    return jsonResponse(400, { error: 'invalid_grant', error_description: 'Code expired' });
  }

  if (stored.clientId !== clientId) {
    return jsonResponse(400, { error: 'invalid_grant', error_description: 'Client mismatch' });
  }

  // Verify PKCE
  if (stored.codeChallenge && codeVerifier) {
    if (!verifyPkce(codeVerifier, stored.codeChallenge)) {
      return jsonResponse(400, { error: 'invalid_grant', error_description: 'PKCE verification failed' });
    }
  }

  const accessToken = createAccessToken(clientId);

  return jsonResponse(200, {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: TOKEN_TTL,
  });
}

/** Simple HTML login page. */
function loginPage({ clientId, redirectUri, state, codeChallenge, codeChallengeMethod, error }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Selenium MCP — Sign In</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #0f172a; color: #e2e8f0; min-height: 100vh;
           display: flex; align-items: center; justify-content: center; }
    .card { background: #1e293b; border-radius: 12px; padding: 2rem;
            width: 100%; max-width: 380px; box-shadow: 0 4px 24px rgba(0,0,0,.4); }
    h1 { font-size: 1.25rem; margin-bottom: .25rem; }
    .sub { color: #94a3b8; font-size: .875rem; margin-bottom: 1.5rem; }
    label { display: block; font-size: .875rem; color: #94a3b8; margin-bottom: .375rem; }
    input[type=password] { width: 100%; padding: .625rem .75rem; border-radius: 8px;
           border: 1px solid #334155; background: #0f172a; color: #e2e8f0;
           font-size: 1rem; outline: none; }
    input:focus { border-color: #3b82f6; }
    button { width: 100%; padding: .625rem; border-radius: 8px; border: none;
             background: #3b82f6; color: #fff; font-size: 1rem; font-weight: 500;
             cursor: pointer; margin-top: 1rem; }
    button:hover { background: #2563eb; }
    .error { color: #f87171; font-size: .875rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <form class="card" method="POST" action="/authorize">
    <h1>Selenium MCP</h1>
    <p class="sub">Sign in to connect your browser automation tools</p>
    ${error ? `<p class="error">${error}</p>` : ''}
    <label for="pw">Password</label>
    <input type="password" id="pw" name="password" required autofocus>
    <input type="hidden" name="client_id" value="${esc(clientId)}">
    <input type="hidden" name="redirect_uri" value="${esc(redirectUri)}">
    <input type="hidden" name="state" value="${esc(state)}">
    <input type="hidden" name="code_challenge" value="${esc(codeChallenge)}">
    <input type="hidden" name="code_challenge_method" value="${esc(codeChallengeMethod)}">
    <button type="submit">Sign In</button>
  </form>
</body>
</html>`;
}

function esc(str) {
  return (str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ---------------------------------------------------------------------------
// S3 upload helpers
// ---------------------------------------------------------------------------

async function uploadToS3(localPath) {
  const key = `screenshots/${basename(localPath)}`;
  const body = await readFile(localPath);
  const contentType = localPath.endsWith('.jpg') || localPath.endsWith('.jpeg')
    ? 'image/jpeg' : 'image/png';

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));

  return `s3://${S3_BUCKET}/${key}`;
}

async function uploadScreenshots(responseBody) {
  if (!s3) return responseBody;

  try {
    const parsed = JSON.parse(responseBody);
    const results = Array.isArray(parsed) ? parsed : [parsed];
    let modified = false;

    for (const msg of results) {
      const content = msg?.result?.content;
      if (!Array.isArray(content)) continue;

      for (const item of content) {
        if (item.type !== 'text') continue;

        const match = item.text?.match(/Saved to (\/tmp\/screenshots\/\S+)/);
        if (!match) continue;

        try {
          const s3Url = await uploadToS3(match[1]);
          item.text = item.text.replace(match[0], `${match[0]}\nUploaded to ${s3Url}`);
          modified = true;
        } catch (err) {
          console.error('S3 upload failed:', err);
        }
      }
    }

    return modified
      ? JSON.stringify(Array.isArray(parsed) ? results : results[0])
      : responseBody;
  } catch {
    return responseBody;
  }
}

// ---------------------------------------------------------------------------
// Main Lambda handler
// ---------------------------------------------------------------------------

export async function handler(event) {
  await ready;

  const method = event.requestContext?.http?.method ?? 'POST';
  const path = event.rawPath ?? '/mcp';

  // --- Public endpoints (no auth required) ---

  if (path === '/health') {
    return jsonResponse(200, { status: 'ok' });
  }

  if (path === '/.well-known/oauth-authorization-server') {
    return handleAuthServerMetadata(event);
  }

  if (path === '/.well-known/oauth-protected-resource') {
    return handleProtectedResourceMetadata(event);
  }

  if (path === '/register' && method === 'POST') {
    return handleRegister(event);
  }

  if (path === '/authorize') {
    return handleAuthorize(event);
  }

  if (path === '/token' && method === 'POST') {
    return handleToken(event);
  }

  // --- Protected endpoint (auth required) ---

  if (path !== '/mcp') {
    return { statusCode: 404, body: 'Not Found' };
  }

  if (!isAuthorized(event)) {
    const base = getBaseUrl(event);
    return {
      statusCode: 401,
      headers: {
        'www-authenticate': 'Bearer',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  // --- MCP request handling ---

  const server = await createServerFn(contextInstance);
  const transport = new TransportClass({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);

    const url = `${getBaseUrl(event)}${path}${
      event.rawQueryString ? '?' + event.rawQueryString : ''
    }`;

    const headers = new Headers(event.headers ?? {});
    const bodyText = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64').toString('utf-8')
      : event.body ?? '';

    const request = new Request(url, {
      method,
      headers,
      body: method !== 'GET' && method !== 'HEAD' ? bodyText : undefined,
    });

    const response = await transport.handleRequest(request, {
      parsedBody: bodyText ? JSON.parse(bodyText) : undefined,
    });

    let responseBody = await response.text();
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    responseBody = await uploadScreenshots(responseBody);

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: responseBody,
      isBase64Encoded: false,
    };
  } catch (err) {
    console.error('MCP handler error:', err);
    return jsonResponse(500, {
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal server error' },
      id: null,
    });
  } finally {
    await transport.close();
    await server.close();
  }
}
