import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const presets: Record<string, { width: number; height: number }> = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
  'desktop-hd': { width: 1920, height: 1080 },
};

const presetNames = Object.keys(presets) as [string, ...string[]];

const schema = z.object({
  width: z.coerce.number().optional().describe('Window width in pixels'),
  height: z.coerce.number().optional().describe('Window height in pixels'),
  preset: z.enum(presetNames).optional().describe('Device preset: mobile (375x812), tablet (768x1024), desktop (1280x800), desktop-hd (1920x1080)'),
}).refine(
  (data) => data.preset !== undefined || (data.width !== undefined && data.height !== undefined),
  { message: 'Provide either a "preset" or both "width" and "height"', path: ['width'] }
);

export class ResizeTool extends BaseTool {
  readonly name = 'resize_window';
  readonly description = 'Resize the browser window to specified dimensions or a device preset (mobile, tablet, desktop, desktop-hd)';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'browser';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const parsed = this.parseParams(schema, params);

    const { width, height } = parsed.preset
      ? presets[parsed.preset]
      : { width: parsed.width!, height: parsed.height! };

    const driver = await context.getDriver();
    await driver.manage().window().setRect({ width, height });

    const label = parsed.preset ? `${parsed.preset} (${width}x${height})` : `${width}x${height}`;
    return this.success(`Window resized to ${label}`, false);
  }
}
