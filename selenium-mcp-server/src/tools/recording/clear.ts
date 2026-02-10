import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({});

export class ClearRecordingTool extends BaseTool {
  readonly name = 'clear_recording';
  readonly description = 'Clear all recorded browser actions';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'recording';

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    const actionCount = context.actionHistory.length;
    context.clearRecording();
    return this.success(`Cleared ${actionCount} recorded actions`, false);
  }
}
