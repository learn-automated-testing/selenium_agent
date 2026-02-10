import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  tabId: z.number().describe('Tab ID to select (0-based index)')
});

export class TabSelectTool extends BaseTool {
  readonly name = 'tab_select';
  readonly description = 'Switch to a specific browser tab by index';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'browser';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { tabId } = this.parseParams(schema, params);

    const tabs = await context.getTabs();
    if (tabId < 0 || tabId >= tabs.length) {
      return this.error(`Tab ID ${tabId} not found. Available tabs: 0-${tabs.length - 1}`);
    }

    await context.switchToTab(tabs[tabId].handle);

    return this.success(`Switched to tab ${tabId}: ${tabs[tabId].title}`, true);
  }
}
