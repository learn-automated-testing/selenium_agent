import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({});

export class SnapshotTool extends BaseTool {
  readonly name = 'capture_page';
  readonly description = 'Capture the current page state including all interactive elements. Returns a structured snapshot with element references (e1, e2, etc.) that can be used for interactions.';
  readonly inputSchema = schema;

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    await context.captureSnapshot();
    const snapshotText = context.formatSnapshotAsText();
    return this.success(snapshotText, false);
  }
}
