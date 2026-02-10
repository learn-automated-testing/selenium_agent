import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  x: z.number().describe('X coordinate'),
  y: z.number().describe('Y coordinate')
});

export class MouseMoveTool extends BaseTool {
  readonly name = 'mouse_move';
  readonly description = 'Move mouse to specific coordinates';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'interaction';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { x, y } = this.parseParams(schema, params);

    const driver = await context.getDriver();
    const actions = driver.actions({ async: true });
    await actions.move({ x, y }).perform();

    return this.success(`Moved mouse to coordinates (${x}, ${y})`, false);
  }
}
