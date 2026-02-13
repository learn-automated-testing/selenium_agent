import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({});

export class RecordingStatusTool extends BaseTool {
  readonly name = 'recording_status';
  readonly description = 'Check if recording is active and show recorded actions';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'recording';
  readonly annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    const status = context.getRecordingStatus();
    const statusStr = status.enabled ? 'ACTIVE' : 'INACTIVE';

    const lines: string[] = [
      `Recording Status: ${statusStr}`,
      `Recorded Actions: ${status.actionCount}`,
      ''
    ];

    if (context.actionHistory.length > 0) {
      lines.push('Recent Actions:');
      const recentActions = context.actionHistory.slice(-5);
      recentActions.forEach((action, i) => {
        lines.push(`  ${i + 1}. ${action.tool} - ${JSON.stringify(action.params)}`);
      });

      if (context.actionHistory.length > 5) {
        lines.push(`  ... and ${context.actionHistory.length - 5} more actions`);
      }
    }

    return this.success(lines.join('\n'), false);
  }
}
