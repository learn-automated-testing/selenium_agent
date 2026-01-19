import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({});

export class StopRecordingTool extends BaseTool {
  readonly name = 'stop_recording';
  readonly description = 'Stop recording browser actions';
  readonly inputSchema = schema;

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    const actionCount = context.actionHistory.length;
    context.stopRecording();
    return this.success(`Recording stopped - captured ${actionCount} actions`, false);
  }
}
