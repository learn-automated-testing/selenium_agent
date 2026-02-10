import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  tabId: z.number().describe('Tab ID to close (0-based index)')
});

export class TabCloseTool extends BaseTool {
  readonly name = 'tab_close';
  readonly description = 'Close a specific browser tab';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'browser';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { tabId } = this.parseParams(schema, params);

    const driver = await context.getDriver();
    const handles = await driver.getAllWindowHandles();

    if (tabId < 0 || tabId >= handles.length) {
      return this.error(`Tab ID ${tabId} not found. Available tabs: 0-${handles.length - 1}`);
    }

    const currentHandle = await driver.getWindowHandle();
    const targetHandle = handles[tabId];

    // Switch to target tab and close it
    await driver.switchTo().window(targetHandle);
    await driver.close();

    // Switch to another tab if we closed the current one
    const remainingHandles = handles.filter(h => h !== targetHandle);
    if (remainingHandles.length > 0) {
      if (targetHandle === currentHandle) {
        await driver.switchTo().window(remainingHandles[0]);
      } else {
        await driver.switchTo().window(currentHandle);
      }
    }

    return this.success(`Closed tab ${tabId}`, true);
  }
}
