import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({});

export class StartRecordingTool extends BaseTool {
  readonly name = 'start_recording';
  readonly description = 'Start recording browser actions to generate test scripts later';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'recording';
  readonly annotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    context.startRecording();
    return this.success('Recording started - all browser actions will be tracked', false);
  }
}
