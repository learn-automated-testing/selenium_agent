import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({});

export class GoForwardTool extends BaseTool {
  readonly name = 'go_forward';
  readonly description = 'Navigate forward in browser history';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'navigation';

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    const driver = await context.getDriver();
    await driver.navigate().forward();

    const url = await driver.getCurrentUrl();
    return this.success(`Navigated forward to ${url}`, true);
  }
}
