import { z } from 'zod';
import path from 'path';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { getOutputDir } from '../../utils/paths.js';

const SCREENSHOTS_DIR = 'screenshots';

const schema = z.object({
  filename: z.string().optional().describe('Optional filename to save screenshot (saved to <output>/screenshots/)')
});

export class ScreenshotTool extends BaseTool {
  readonly name = 'take_screenshot';
  readonly description = 'Take a screenshot of the current page. Returns the screenshot as base64 image.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'page';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { filename } = this.parseParams(schema, params);

    const driver = await context.getDriver();
    const base64 = await driver.takeScreenshot();

    if (filename) {
      const fs = await import('fs/promises');

      // If filename is already an absolute path, use it as-is.
      // Otherwise, save to <outputDir>/screenshots/<filename>.png
      let savePath: string;
      if (path.isAbsolute(filename)) {
        savePath = filename;
      } else {
        const screenshotsDir = path.join(getOutputDir(), SCREENSHOTS_DIR);
        await fs.mkdir(screenshotsDir, { recursive: true });
        // Ensure .png extension
        const safeName = filename.endsWith('.png') ? filename : `${filename}.png`;
        savePath = path.join(screenshotsDir, safeName);
      }

      await fs.writeFile(savePath, base64, 'base64');
      return this.success(`Screenshot saved to ${savePath}`);
    }

    return this.successWithImage('Screenshot captured', base64);
  }
}
