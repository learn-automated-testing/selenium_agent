import { z } from 'zod';
import path from 'path';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { getOutputDir } from '../../utils/paths.js';
import { getBidiContext } from '../../utils/bidi-helpers.js';
import { validateOutputPath } from '../../utils/sandbox.js';

const SCREENSHOTS_DIR = 'screenshots';

const schema = z.object({
  filename: z.string().optional().describe('Optional filename to save screenshot (saved to <output>/screenshots/)'),
  origin: z.enum(['viewport', 'document']).optional().describe('Screenshot origin: viewport (visible area, default) or document (full page)'),
  ref: z.string().optional().describe('Element ref for element screenshot (e.g. "e5")'),
  format: z.enum(['png', 'jpeg']).optional().describe('Image format (default: png)'),
  quality: z.number().min(0).max(100).optional().describe('JPEG quality 0-100 (only for jpeg format)'),
});

export class ScreenshotTool extends BaseTool {
  readonly name = 'take_screenshot';
  readonly description = 'Take a screenshot of the current page, viewport, full page, or specific element. Uses BiDi for full-page and element screenshots when available, falls back to classic API.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'page';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { filename, origin, ref, format, quality } = this.parseParams(schema, params);

    const driver = await context.getDriver();
    const outputMode = context.getOutputMode();
    const imageFormat = format ?? 'png';
    const mimeType = imageFormat === 'jpeg' ? 'image/jpeg' : 'image/png';

    let base64: string;

    // Try BiDi screenshot for advanced features (full-page, element)
    if (origin === 'document' || ref) {
      const bidi = await getBidiContext(driver);
      if (bidi) {
        try {
          if (ref) {
            // Element screenshot via BiDi
            const element = await context.getElementByRef(ref);
            const rect = await driver.executeScript(
              'const r = arguments[0].getBoundingClientRect(); return {x: r.x, y: r.y, width: r.width, height: r.height};',
              element
            ) as { x: number; y: number; width: number; height: number };

            base64 = await bidi.browsingContext.captureBoxScreenshot(
              rect.x, rect.y, rect.width, rect.height
            );
          } else {
            // Full-page screenshot via BiDi Origin.DOCUMENT
            base64 = await bidi.browsingContext.captureScreenshot({
              origin: 'document',
              ...(imageFormat === 'jpeg' ? { format: { type: 'image/jpeg', quality: (quality ?? 80) / 100 } } : {}),
            });
          }

          return this.handleOutput(base64, filename, mimeType, outputMode, origin ?? 'document', ref);
        } catch {
          // Fall through to classic API
        }
      }
    }

    // Classic screenshot (viewport only)
    base64 = await driver.takeScreenshot();

    return this.handleOutput(base64, filename, mimeType, outputMode, origin ?? 'viewport', ref);
  }

  private async handleOutput(
    base64: string,
    filename: string | undefined,
    mimeType: string,
    outputMode: 'stdout' | 'file',
    origin: string,
    ref: string | undefined,
  ): Promise<ToolResult> {
    const description = ref
      ? `Element (${ref}) screenshot captured`
      : `${origin === 'document' ? 'Full-page' : 'Viewport'} screenshot captured`;

    if (filename || outputMode === 'file') {
      const fs = await import('fs/promises');

      let savePath: string;
      const name = filename || `screenshot-${Date.now()}`;

      if (path.isAbsolute(name)) {
        savePath = name;
      } else {
        const screenshotsDir = path.join(getOutputDir(), SCREENSHOTS_DIR);
        await fs.mkdir(screenshotsDir, { recursive: true });
        const ext = mimeType === 'image/jpeg' ? '.jpg' : '.png';
        const safeName = name.endsWith(ext) || name.endsWith('.png') || name.endsWith('.jpg')
          ? name : `${name}${ext}`;
        savePath = path.join(screenshotsDir, safeName);
      }

      const unrestricted = process.env.SELENIUM_MCP_UNRESTRICTED_FILES === 'true';
      validateOutputPath(savePath, unrestricted);
      await fs.writeFile(savePath, base64, 'base64');
      return this.success(`${description}. Saved to ${savePath}`);
    }

    return this.successWithImage(description, base64);
  }
}
