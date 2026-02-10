import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  url: z.string().optional().describe('URL to open in new tab (optional, opens blank tab if not specified)')
});

export class TabNewTool extends BaseTool {
  readonly name = 'tab_new';
  readonly description = 'Open a new browser tab';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'browser';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { url } = this.parseParams(schema, params);

    const driver = await context.getDriver();

    // Open new tab using JavaScript
    await driver.executeScript("window.open('');");

    // Get all window handles and switch to the new one
    const handles = await driver.getAllWindowHandles();
    await driver.switchTo().window(handles[handles.length - 1]);

    // Navigate to URL if provided
    if (url) {
      await driver.get(url);
      return this.success(`Opened new tab and navigated to ${url}`, true);
    }

    return this.success('Opened new blank tab', true);
  }
}
