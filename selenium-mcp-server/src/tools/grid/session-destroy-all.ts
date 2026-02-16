import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  tags: z.array(z.string()).optional().describe('Only destroy sessions matching these tags. If omitted, all sessions are destroyed.'),
});

export class SessionDestroyAllTool extends BaseTool {
  readonly name = 'session_destroy_all';
  readonly description = '[Advanced — Grid] Destroy all browser sessions on the Selenium Grid, optionally filtered by tags. Only relevant for parallel multi-browser testing.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'grid';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { tags } = this.parseParams(schema, params);
    const { pool } = await context.ensureGrid();

    // Deselect active session if it would be destroyed
    if (context.activeSessionId) {
      context.selectSession(null);
    }
    const count = await pool.destroyAll(tags);
    const tagStr = tags && tags.length > 0 ? ` matching tags [${tags.join(', ')}]` : '';
    return this.success(`Destroyed ${count} session(s)${tagStr}.`);
  }
}
