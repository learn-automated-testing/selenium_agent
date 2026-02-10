import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  ref: z.string().describe('Element reference (e.g., e1, e2) from page snapshot')
});

export class HoverTool extends BaseTool {
  readonly name = 'hover_element';
  readonly description = 'Hover over an element using its reference from the page snapshot';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'interaction';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { ref } = this.parseParams(schema, params);

    const driver = await context.getDriver();
    const element = await context.getElementByRef(ref);

    const actions = driver.actions({ async: true });
    await actions.move({ origin: element }).perform();

    return this.success(`Hovered over element ${ref}`, true);
  }
}
