import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  filename: z.string().optional().describe('Optional filename to save screenshot')
});

export class ScreenshotTool extends BaseTool {
  readonly name = 'take_screenshot';
  readonly description = 'Take a screenshot of the current page. Returns the screenshot as base64 image.';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { filename } = this.parseParams(schema, params);

    const driver = await context.getDriver();
    const base64 = await driver.takeScreenshot();

    if (filename) {
      const fs = await import('fs/promises');
      await fs.writeFile(filename, base64, 'base64');
      return this.success(`Screenshot saved to ${filename}`);
    }

    return this.successWithImage('Screenshot captured', base64);
  }
}
