import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({});

export class ResetSessionTool extends BaseTool {
  readonly name = 'reset_session';
  readonly description = 'Reset the browser session (close and restart browser)';
  readonly inputSchema = schema;

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    await context.reset();
    return this.success('Browser session reset', false);
  }
}
