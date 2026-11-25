import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { dragDeep } from '../../utils/shadow-dom.js';

const schema = z.object({
  sourceRef: z.string().describe('Source element reference from page snapshot (e.g. "e5")'),
  targetRef: z.string().describe('Target element reference from page snapshot (e.g. "e10")'),
});

export class DragDropTool extends BaseTool {
  readonly name = 'drag_drop';
  readonly description = 'Drag and drop from source element to target element';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'interaction';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { sourceRef, targetRef } = this.parseParams(schema, params);

    const source = await context.getTargetByRef(sourceRef);
    const target = await context.getTargetByRef(targetRef);

    const driver = await context.getDriver();
    if (source.element && target.element) {
      const actions = driver.actions({ async: true });
      await actions.dragAndDrop(source.element, target.element).perform();
    } else {
      // At least one end is in shadow DOM WebDriver cannot reach: drag with real mouse events at the positions.
      await dragDeep(driver, source, target);
    }

    return this.success(`Dragged ${sourceRef} to ${targetRef}`, true);
  }
}
