import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  sourceRef: z.string().describe('Source element reference from page snapshot'),
  targetRef: z.string().describe('Target element reference from page snapshot')
});

export class DragDropTool extends BaseTool {
  readonly name = 'drag_drop';
  readonly description = 'Drag and drop from source element to target element';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { sourceRef, targetRef } = this.parseParams(schema, params);

    const driver = await context.getDriver();
    const sourceElement = await context.getElementByRef(sourceRef);
    const targetElement = await context.getElementByRef(targetRef);

    const actions = driver.actions({ async: true });
    await actions.dragAndDrop(sourceElement, targetElement).perform();

    return this.success(`Dragged ${sourceRef} to ${targetRef}`, true);
  }
}
