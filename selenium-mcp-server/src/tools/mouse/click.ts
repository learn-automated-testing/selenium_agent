import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  ref: z.string().describe('Element reference from page snapshot'),
  button: z.enum(['left', 'right', 'middle']).optional().default('left').describe('Mouse button to click')
});

export class MouseClickTool extends BaseTool {
  readonly name = 'mouse_click';
  readonly description = 'Click on an element using mouse with specified button';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { ref, button } = this.parseParams(schema, params);

    const driver = await context.getDriver();
    const element = await context.getElementByRef(ref);
    const actions = driver.actions({ async: true });

    await actions.move({ origin: element }).perform();

    if (button === 'right') {
      await actions.contextClick(element).perform();
    } else {
      // For left and middle, use regular click
      await actions.click(element).perform();
    }

    return this.success(`Clicked element ${ref} with ${button} button`, true);
  }
}
