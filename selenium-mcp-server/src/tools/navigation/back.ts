import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({});

export class GoBackTool extends BaseTool {
  readonly name = 'go_back';
  readonly description = 'Navigate back in browser history';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'navigation';

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    const driver = await context.getDriver();
    await driver.navigate().back();

    const url = await driver.getCurrentUrl();
    return this.success(`Navigated back to ${url}`, true);
  }
}
