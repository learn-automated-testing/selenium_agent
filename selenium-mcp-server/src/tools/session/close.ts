import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({});

export class CloseBrowserTool extends BaseTool {
  readonly name = 'close_browser';
  readonly description = 'Close the browser and end the session';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'session';

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    await context.close();
    return this.success('Browser closed', false);
  }
}
