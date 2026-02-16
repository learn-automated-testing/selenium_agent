import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  sessionId: z.string().describe('The session ID to destroy'),
});

export class SessionDestroyTool extends BaseTool {
  readonly name = 'session_destroy';
  readonly description = '[Advanced — Grid] Destroy a specific browser session on the Selenium Grid. Only relevant for parallel multi-browser testing.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'grid';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { sessionId } = this.parseParams(schema, params);
    const { pool } = await context.ensureGrid();

    const destroyed = await pool.destroySession(sessionId);
    if (destroyed) {
      // Deselect if this was the active session
      if (context.activeSessionId === sessionId) {
        context.selectSession(null);
      }
      return this.success(`Session "${sessionId}" destroyed.`);
    }
    return this.error(`Session "${sessionId}" not found.`);
  }
}
