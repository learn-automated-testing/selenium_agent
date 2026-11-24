import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { hoverDeep } from '../../utils/shadow-dom.js';

const schema = z.object({
  ref: z.string().describe('Element reference (e.g., e1, e2) from page snapshot'),
});

export class HoverTool extends BaseTool {
  readonly name = 'hover_element';
  readonly description = 'Hover over an element using its reference from the page snapshot';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'interaction';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { ref } = this.parseParams(schema, params);

    const target = await context.getTargetByRef(ref);
    const driver = await context.getDriver();

    if (!target.element) {
      // WebDriver cannot hold this element (shadow-DOM polyfill): move the mouse to its position instead
      await hoverDeep(driver, target.selector);
      return this.success(`Hovered over element ${ref} (in shadow DOM: mouse moved to its position, ${target.selector})`, true);
    }

    const actions = driver.actions({ async: true });
    await actions.move({ origin: target.element }).perform();

    return this.success(`Hovered over element ${ref}`, true);
  }
}
