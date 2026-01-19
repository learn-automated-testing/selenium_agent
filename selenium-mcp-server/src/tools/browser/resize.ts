import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  width: z.number().describe('Window width in pixels'),
  height: z.number().describe('Window height in pixels')
});

export class ResizeTool extends BaseTool {
  readonly name = 'resize_window';
  readonly description = 'Resize the browser window to specified dimensions';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { width, height } = this.parseParams(schema, params);

    const driver = await context.getDriver();
    await driver.manage().window().setRect({ width, height });

    return this.success(`Window resized to ${width}x${height}`, false);
  }
}
