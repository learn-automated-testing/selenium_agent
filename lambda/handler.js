/**
 * AWS Lambda handler for Selenium MCP server.
 *
 * Runs the full MCP tool set over Streamable HTTP transport using
 * selenium-webdriver + @sparticuz/chromium (headless Chrome in Lambda).
 *
 * Exposed via Lambda Function URL — each POST to /mcp is an MCP request.
 * Uses enableJsonResponse so Lambda returns plain JSON (no SSE streaming).
 *
 * Cold start: extracts Chromium binary, creates MCP server + transport.
 * Warm invocations: reuses server, transport, and Chrome session.
 */

import chromium from '@sparticuz/chromium';

// Configure environment before the MCP server modules are imported.
// The server reads these env vars during createServer() / buildChromeOptions().
process.env.SELENIUM_HEADLESS = 'true';
process.env.SELENIUM_LAMBDA = 'true';

// Resolve chromium binary once (extracts from .br on first call, cached after).
const chromiumPath = chromium.executablePath();

let transport;
let ready;

async function initialize() {
  process.env.SELENIUM_CHROME_BINARY = await chromiumPath;

  // Dynamic imports so env vars are set before module-level code runs.
  const { createServer } = await import('./dist/src/server.js');
  const { StreamableHTTPServerTransport } = await import(
    '@modelcontextprotocol/sdk/server/streamableHttp.js'
  );

  transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no session tracking
    enableJsonResponse: true,      // return JSON, not SSE (required for Lambda)
  });

  const server = await createServer();
  await server.connect(transport);
}

ready = initialize();

/**
 * Lambda Function URL handler.
 *
 * Converts the Lambda event (payload format 2.0) to a Node.js-style
 * IncomingMessage/ServerResponse pair and delegates to the MCP transport.
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

  // The transport's _webStandardTransport handles the MCP protocol.
  // We access it via the Node.js wrapper's handleRequest, which internally
  // converts to Web Standard Request/Response.  However, to avoid constructing
  // fake IncomingMessage/ServerResponse, we call the underlying web-standard
  // transport directly.
  //
  // StreamableHTTPServerTransport stores it as _webStandardTransport (private).
  // We use a simple bridge: pipe through a minimal Node.js http pair.
  const response = await handleViaNodeBridge(request);

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.body,
    isBase64Encoded: false,
  };
}

/**
 * Bridge: convert a Web Standard Request into a Node.js IncomingMessage +
 * ServerResponse, call transport.handleRequest(), then collect the response.
 */
function handleViaNodeBridge(request) {
  return new Promise(async (resolve, reject) => {
    const { Readable } = await import('node:stream');
    const { IncomingMessage, ServerResponse } = await import('node:http');
    const { Socket } = await import('node:net');

    // Build a minimal IncomingMessage
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = request.method;
    req.url = new URL(request.url).pathname + new URL(request.url).search;
    req.headers = Object.fromEntries(request.headers.entries());

    // Push the body into the readable stream
    const bodyText = request.method !== 'GET' && request.method !== 'HEAD'
      ? await request.text()
      : '';
    if (bodyText) {
      req.push(bodyText);
    }
    req.push(null);

    // Build a minimal ServerResponse that captures the output
    const res = new ServerResponse(req);
    const chunks = [];

    // Intercept writes
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    res.write = (chunk, ...args) => {
      chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return originalWrite(chunk, ...args);
    };

    res.end = (chunk, ...args) => {
      if (chunk) {
        chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
      }
      const result = {
        statusCode: res.statusCode,
        headers: {},
        body: chunks.join(''),
      };
      // Collect headers
      const rawHeaders = res.getHeaders();
      for (const [key, val] of Object.entries(rawHeaders)) {
        result.headers[key] = Array.isArray(val) ? val.join(', ') : String(val);
      }
      resolve(result);
      return originalEnd(chunk, ...args);
    };

    try {
      await transport.handleRequest(req, res, bodyText ? JSON.parse(bodyText) : undefined);
    } catch (err) {
      resolve({
        statusCode: 500,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: err.message }),
      });
    }
  });
}
