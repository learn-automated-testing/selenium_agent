import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  sessionId: z.string().optional().describe('Custom session ID. Auto-generated if not provided.'),
  browser: z.string().optional().default('chrome').describe('Browser name (chrome, firefox)'),
  tags: z.array(z.string()).optional().default([]).describe('Tags for grouping/filtering sessions'),
});

export class SessionCreateTool extends BaseTool {
  readonly name = 'session_create';
  readonly description = 'Create a new browser session on the Selenium Grid. Returns the session ID for use with other grid tools.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'grid';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { sessionId, browser, tags } = this.parseParams(schema, params);
    const { pool } = await context.ensureGrid();

    const session = await pool.createSession(
      { browserName: browser },
      sessionId,
      tags
    );

    return this.success(
      `Session created: ${session.sessionId}\n` +
      `Browser: ${session.browser}\n` +
      `Tags: ${session.tags.length > 0 ? session.tags.join(', ') : '(none)'}`
    );
  }
}
