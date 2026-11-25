import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { clickDeep } from '../../utils/shadow-dom.js';

const schema = z.object({
  ref: z.string().describe('Element reference (e.g., e1, e2) from page snapshot'),
});

export class ClickTool extends BaseTool {
  readonly name = 'click_element';
  readonly description = 'Click on an element using its reference from the page snapshot';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'interaction';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { ref } = this.parseParams(schema, params);

    const target = await context.getTargetByRef(ref);
    if (target.element) {
      await target.element.click();
      return this.success(`Clicked element ${ref}`, true);
    }

    // WebDriver cannot hold this element (shadow-DOM polyfill): real mouse click at its position instead
    await clickDeep(await context.getDriver(), target.selector);
    return this.success(`Clicked element ${ref} (in shadow DOM: real mouse click at its position, ${target.selector})`, true);
  }
}
