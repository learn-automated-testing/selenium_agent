import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

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
    const sourceElement = await context.getElementByRef(fromRef);
    const targetElement = await context.getElementByRef(toRef);

    const actions = driver.actions({ async: true });
    await actions.dragAndDrop(sourceElement, targetElement).perform();

    return this.success(`Dragged from ${fromRef} to ${toRef}`, true);
  }
}
