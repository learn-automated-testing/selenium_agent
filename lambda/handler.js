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
 * MCP clients batch initialize + notifications/initialized + tools/call
 * in a single POST for stateless mode.
 */

import chromium from '@sparticuz/chromium';

// Configure environment before the MCP server modules are imported.
process.env.SELENIUM_HEADLESS = 'true';
process.env.SELENIUM_LAMBDA = 'true';
process.env.SELENIUM_MCP_OUTPUT_DIR = '/tmp';

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
    const responseBody = await response.text();
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

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
