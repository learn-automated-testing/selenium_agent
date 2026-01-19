import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({});

export class RefreshTool extends BaseTool {
  readonly name = 'refresh_page';
  readonly description = 'Refresh the current page';
  readonly inputSchema = schema;

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    const driver = await context.getDriver();
    await driver.navigate().refresh();

    const url = await driver.getCurrentUrl();
    return this.success(`Refreshed page: ${url}`, true);
  }
}
