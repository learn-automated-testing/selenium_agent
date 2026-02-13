import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getAllTools } from './tools/index.js';
import { Context } from './context.js';
import { zodToJsonSchema } from './utils/schema.js';
import { ExpectationSchema } from './tools/base.js';
import { Expectation } from './types.js';
import { SessionTracer } from './trace/session-tracer.js';

// Pre-compute the expectation JSON schema once
const expectationJsonSchema = zodToJsonSchema(ExpectationSchema.unwrap());

export async function createServer() {
  const server = new Server(
    {
      name: 'selenium-mcp',
      version: '2.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  const outputMode = (process.env.SELENIUM_MCP_OUTPUT_MODE === 'file' ? 'file' : 'stdout') as 'stdout' | 'file';
  const saveTrace = process.env.SELENIUM_MCP_SAVE_TRACE === 'true';
  const context = new Context({
    stealth: process.env.SELENIUM_STEALTH === 'true',
    outputMode,
  });

  // Enable session tracing if configured
  if (saveTrace) {
    context.tracer = new SessionTracer();
  }

  const tools = getAllTools();

  // List available tools — inject expectation property into every tool's schema
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(t => {
      const schema = zodToJsonSchema(t.inputSchema) as Record<string, any>;
      // Inject expectation as an optional property
      if (schema.type === 'object') {
        schema.properties = {
          ...schema.properties,
          expectation: expectationJsonSchema,
        };
        // Don't add expectation to required
      }
      return {
        name: t.name,
        description: t.description,
        inputSchema: schema,
        annotations: t.getAnnotations(),
      };
    })
  }));

  // Execute tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = tools.find(t => t.name === name);

    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true
      };
    }

    try {
      // Resolve expectation from args and category defaults
      const expectation: Expectation = tool.resolveExpectation(args || {});

      // Strip expectation from args before passing to tool.execute()
      const cleanArgs = { ...(args || {}) };
      delete (cleanArgs as Record<string, unknown>).expectation;

      // Record tool call in tracer
      if (context.tracer) {
        context.tracer.recordToolCall(name, cleanArgs);
      }

      const result = await tool.execute(context, cleanArgs);

      // Record result in tracer
      if (context.tracer) {
        context.tracer.recordToolResult(name, { content: result.content, isError: result.isError });
      }

      // Record action if recording is enabled (just a Map lookup, no browser calls)
      if (!result.isError) {
        context.recordAction(name, cleanArgs);
      }

      // Determine whether to include snapshot
      const shouldSnapshot = expectation.includeSnapshot ?? result.captureSnapshot;

      if (shouldSnapshot && !result.isError) {
        // Check if diff mode is requested
        if (expectation.diffOptions?.enabled) {
          const { snapshot, diff } = await context.captureSnapshotWithDiff(
            expectation.snapshotOptions,
            expectation.diffOptions
          );
          if (diff) {
            result.content = `${result.content}\n\n[DIFF]\n${diff}`;
          } else {
            // No previous snapshot to diff against, include full snapshot
            result.content = `${result.content}\n\n${snapshot}`;
          }
        } else {
          await context.captureSnapshot(expectation.snapshotOptions);
          const snapshotText = context.formatSnapshotAsText(expectation.snapshotOptions);
          result.content = `${result.content}\n\n${snapshotText}`;
        }
      }

      // Append console logs if requested
      if (expectation.includeConsole) {
        const logs = context.getConsoleLogs(expectation.consoleOptions);
        if (logs.length > 0) {
          const logText = logs.map(l => `[${l.level}] ${l.message}`).join('\n');
          result.content = `${result.content}\n\n[CONSOLE]\n${logText}`;
        }
      }

      // Append network summary if requested
      if (expectation.includeNetwork && context.eventCollector?.isActive) {
        const networkSummary = context.eventCollector.getNetworkSummary();
        if (networkSummary) {
          result.content = `${result.content}\n\n[NETWORK]\n${networkSummary}`;
        }
      }

      const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [
        { type: 'text', text: result.content }
      ];

      // Add image if present
      if (result.base64Image) {
        content.push({
          type: 'image',
          data: result.base64Image,
          mimeType: 'image/png'
        });
      }

      // Add base64 resource if present (PDF, etc.)
      if (result.base64Resource) {
        content.push({
          type: 'resource',
          data: result.base64Resource.data,
          mimeType: result.base64Resource.mimeType,
        });
      }

      return {
        content,
        isError: result.isError
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true
      };
    }
  });

  // Cleanup on exit
  process.on('SIGINT', async () => {
    await context.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await context.close();
    process.exit(0);
  });

  return server;
}

export async function runServer() {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
