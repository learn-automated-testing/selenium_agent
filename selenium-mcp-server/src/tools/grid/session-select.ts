import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  sessionId: z.string().nullable().describe('Session ID to select as active. Pass null to deselect and return to the local browser.'),
});

export class SessionSelectTool extends BaseTool {
  readonly name = 'session_select';
  readonly description = '[Advanced — Grid] Select a grid session as the active browser. All subsequent tool calls will operate on this session. Pass null to switch back to the local browser. Only use after session_create for parallel testing.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'grid';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { sessionId } = this.parseParams(schema, params);

    if (sessionId === null) {
      const prev = context.activeSessionId;
      context.selectSession(null);
      return this.success(
        prev
          ? `Deselected session "${prev}". Now using local browser.`
          : 'Already using local browser.'
      );
    }

    // Ensure grid is initialized
    await context.ensureGrid();

    context.selectSession(sessionId);

    // Get basic info about the selected session
    const { pool } = await context.ensureGrid();
    const session = pool.getSession(sessionId);
    const info = session?.toInfo();

    const lines = [
      `Active session: ${sessionId}`,
      `Browser: ${info?.browser ?? 'unknown'}`,
      `Tags: ${info?.tags && info.tags.length > 0 ? info.tags.join(', ') : '(none)'}`,
      '',
      'All tool calls now target this session.',
      'Use session_select with null to switch back to local browser.',
    ];

    if (info?.url) {
      lines.splice(3, 0, `Current URL: ${info.url}`);
    }

    return this.success(lines.join('\n'));
  }
}
