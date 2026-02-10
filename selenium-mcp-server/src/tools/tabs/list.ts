import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({});

export class TabListTool extends BaseTool {
  readonly name = 'tab_list';
  readonly description = 'List all open browser tabs';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'browser';

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    const tabs = await context.getTabs();

    const tabList = tabs.map((tab, index) =>
      `Tab ${index}: ${tab.title} - ${tab.url}${tab.isActive ? ' (current)' : ''}`
    ).join('\n');

    return this.success(`Open tabs:\n${tabList}`, false);
  }
}
