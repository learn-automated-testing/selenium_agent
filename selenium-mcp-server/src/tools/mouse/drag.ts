import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { dragDeep } from '../../utils/shadow-dom.js';

const schema = z.object({
  fromRef: z.string().describe('Source element reference'),
  toRef: z.string().describe('Target element reference')
});

export class MouseDragTool extends BaseTool {
  readonly name = 'mouse_drag';
  readonly description = 'Drag from one element to another';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'interaction';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { fromRef, toRef } = this.parseParams(schema, params);

    const driver = await context.getDriver();
    const source = await context.getTargetByRef(fromRef);
    const target = await context.getTargetByRef(toRef);

    if (source.element && target.element) {
      const actions = driver.actions({ async: true });
      await actions.dragAndDrop(source.element, target.element).perform();
    } else {
      // At least one end is in shadow DOM WebDriver cannot reach: drag with real mouse events at the positions.
      await dragDeep(driver, source, target);
    }

    return this.success(`Dragged from ${fromRef} to ${toRef}`, true);
  }
}
