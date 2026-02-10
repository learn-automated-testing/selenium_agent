import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  ref: z.string().describe('Element reference (e.g., e1, e2) from page snapshot')
});

export class ClickTool extends BaseTool {
  readonly name = 'click_element';
  readonly description = 'Click on an element using its reference from the page snapshot';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'interaction';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { ref } = this.parseParams(schema, params);

    const element = await context.getElementByRef(ref);
    await element.click();

    return this.success(`Clicked element ${ref}`, true);
  }
}
