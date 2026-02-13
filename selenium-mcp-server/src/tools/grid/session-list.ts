import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  tags: z.array(z.string()).optional().describe('Filter sessions by tags'),
});

export class SessionListTool extends BaseTool {
  readonly name = 'session_list';
  readonly description = 'List all active browser sessions on the Selenium Grid, optionally filtered by tags.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'grid';
  readonly annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { tags } = this.parseParams(schema, params);
    const { pool } = await context.ensureGrid();

    const sessions = pool.listSessions(tags);

    if (sessions.length === 0) {
      return this.success('No active grid sessions.' + (tags ? ` (filtered by tags: ${tags.join(', ')})` : ''));
    }

    const lines: string[] = [
      `Active grid sessions (${sessions.length}):`,
    ];

    for (const s of sessions) {
      const age = Math.round((Date.now() - s.createdAt) / 1000);
      const tagStr = s.tags.length > 0 ? ` [${s.tags.join(', ')}]` : '';
      const urlStr = s.url ? ` @ ${s.url}` : '';
      const activeStr = s.sessionId === context.activeSessionId ? ' (ACTIVE)' : '';
      lines.push(`  - ${s.sessionId} | ${s.browser} | ${age}s old${tagStr}${urlStr}${activeStr}`);
    }

    return this.success(lines.join('\n'));
  }
}
