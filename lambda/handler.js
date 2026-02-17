/**
 * AWS Lambda handler for Selenium MCP server.
 *
 * Runs the full MCP tool set over Streamable HTTP transport using
 * selenium-webdriver + @sparticuz/chromium (headless Chrome in Lambda).
 *
 * Exposed via Lambda Function URL — each POST to /mcp is an MCP request.
 * Uses enableJsonResponse so Lambda returns plain JSON (no SSE streaming).
 *
 * Pattern (from the official MCP SDK stateless example):
 *   - New Server + Transport per request
 *   - Shared Context (browser session) across warm invocations
 *
 * Screenshots saved to /tmp are auto-uploaded to S3 when
 * SCREENSHOT_S3_BUCKET is set.
 */

import chromium from '@sparticuz/chromium';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

// Configure environment before the MCP server modules are imported.
process.env.SELENIUM_HEADLESS = 'true';
process.env.SELENIUM_LAMBDA = 'true';
process.env.SELENIUM_MCP_OUTPUT_DIR = '/tmp';

// S3 client for screenshot uploads (SDK v3 is pre-installed in Lambda runtime).
const S3_BUCKET = process.env.SCREENSHOT_S3_BUCKET;
const s3 = S3_BUCKET ? new S3Client({}) : null;

// Bearer token authentication.
const API_KEY = process.env.MCP_API_KEY;

// Resolve chromium binary once (extracts from .br on first call, cached after).
const chromiumPath = chromium.executablePath();

let createServerFn;
let contextInstance;
let TransportClass;
let ready;

async function initialize() {
  process.env.SELENIUM_CHROME_BINARY = await chromiumPath;

  // Dynamic imports so env vars are set before module-level code runs.
  const serverMod = await import('./dist/src/server.js');
  const contextMod = await import('./dist/src/context.js');
  const transportMod = await import(
    '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
  );

  createServerFn = serverMod.createServer;
  TransportClass = transportMod.WebStandardStreamableHTTPServerTransport;

  // Singleton Context — browser session survives across warm invocations.
  contextInstance = new contextMod.Context({
    stealth: false,
    outputMode: 'stdout',
  });
}

ready = initialize();

/**
 * Upload a local file from /tmp to S3 and return the S3 URL.
 */
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

/**
 * Scan MCP response for screenshots saved to /tmp, upload them to S3,
 * and append the S3 URL to the response text.
 */
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

/**
 * Lambda Function URL handler (payload format 2.0).
 *
 * Following the official MCP SDK stateless pattern: creates a fresh
 * Server + Transport per request. The shared Context preserves the
 * browser session across warm Lambda invocations.
 */
export async function handler(event) {
  await ready;

  const method = event.requestContext?.http?.method ?? 'POST';
  const path = event.rawPath ?? '/mcp';

  // Authenticate — require Bearer token when MCP_API_KEY is set.
  if (API_KEY && path !== '/health') {
    const auth = event.headers?.authorization ?? '';
    if (auth !== `Bearer ${API_KEY}`) {
      return {
        statusCode: 401,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }
  }

  // Health check
  if (path === '/health') {
    return { statusCode: 200, body: JSON.stringify({ status: 'ok' }) };
  }

  // Only accept requests to /mcp
  if (path !== '/mcp') {
    return { statusCode: 404, body: 'Not Found' };
  }

  // Create fresh server + transport per request (official stateless pattern).
  const server = await createServerFn(contextInstance);
  const transport = new TransportClass({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);

    // Build a Web Standard Request from the Lambda event
    const url = `https://${event.requestContext?.domainName ?? 'localhost'}${path}${
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

    // Convert Web Standard Response to Lambda response format
    let responseBody = await response.text();
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Auto-upload screenshots to S3
    responseBody = await uploadScreenshots(responseBody);

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: responseBody,
      isBase64Encoded: false,
    };
  } catch (err) {
    console.error('MCP handler error:', err);
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      }),
    };
  } finally {
    await transport.close();
    await server.close();
  }
}
