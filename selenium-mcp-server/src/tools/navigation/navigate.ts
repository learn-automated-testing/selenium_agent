import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  url: z.string().describe('URL to navigate to')
});

export class NavigateTool extends BaseTool {
  readonly name = 'navigate_to';
  readonly description = 'Navigate the browser to a URL. Starts browser if not running.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'navigation';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { url } = this.parseParams(schema, params);

    const driver = await context.ensureBrowser();
    await driver.get(url);

    const title = await driver.getTitle();
    return this.success(`Navigated to "${title}" (${url})`, true);
  }
}
