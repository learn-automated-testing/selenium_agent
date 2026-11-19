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

const states = ['normal', 'maximize', 'fullscreen', 'minimize'] as const;

const schema = z.object({
  width: z.coerce.number().optional().describe('Window width in pixels'),
  height: z.coerce.number().optional().describe('Window height in pixels'),
  x: z.coerce.number().optional().describe('Window position from the left of the screen, in pixels'),
  y: z.coerce.number().optional().describe('Window position from the top of the screen, in pixels'),
  preset: z.enum(presetNames).optional().describe('Device preset: mobile (375x812), tablet (768x1024), desktop (1280x800), desktop-hd (1920x1080)'),
  state: z
    .enum(states)
    .optional()
    .describe(
      'Window state: fullscreen (whole screen, in front, e.g. for demos and recordings), maximize, ' +
        'minimize (out of view, so other apps are visible), or normal (back to the size and position it had before)'
    ),
}).refine(
  (data) =>
    data.preset !== undefined ||
    data.state !== undefined ||
    (data.width !== undefined && data.height !== undefined) ||
    (data.x !== undefined && data.y !== undefined),
  { message: 'Provide a "state", a "preset", both "width" and "height", or both "x" and "y"', path: ['width'] }
);

interface Rect { x: number; y: number; width: number; height: number }

/** Size and position before the last fullscreen/maximize/minimize, per driver, so "normal" can restore it. */
const normalRects = new WeakMap<object, Rect>();

export class ResizeTool extends BaseTool {
  readonly name = 'resize_window';
  readonly description =
    'Resize or move the browser window, use a device preset (mobile, tablet, desktop, desktop-hd), ' +
    'or change its state: fullscreen (whole screen and in front, ideal for demos and screen recordings), ' +
    'maximize, minimize (out of view, so the AI chat or another app is visible again), or normal (restore)';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'browser';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const parsed = this.parseParams(schema, params);
    const driver = await context.getDriver();
    const window = driver.manage().window();

    if (parsed.state && parsed.state !== 'normal') {
      // Remember where the window was, so "normal" can put it back. Only when it is not
      // already in a special state (going fullscreen → minimize must not overwrite it).
      if (!normalRects.has(driver)) normalRects.set(driver, await window.getRect());
      if (parsed.state === 'minimize') {
        await window.minimize();
      } else {
        const apply = () => (parsed.state === 'fullscreen' ? window.fullscreen() : window.maximize());
        try {
          await apply();
        } catch (err) {
          // Chrome cannot go from minimized straight to fullscreen ("failed to change window
          // state ... current state is 'normal'"): restore the window first, then retry.
          if (!/window state/i.test(String(err))) throw err;
          await window.setRect(normalRects.get(driver) ?? (await window.getRect()));
          await apply();
        }
      }
      return this.success(`Window ${parsed.state === 'fullscreen' ? 'in fullscreen' : parsed.state + 'd'}`, false);
    }

    const size = parsed.preset
      ? presets[parsed.preset]
      : parsed.width !== undefined && parsed.height !== undefined
        ? { width: parsed.width, height: parsed.height }
        : undefined;
    const position = parsed.x !== undefined && parsed.y !== undefined ? { x: parsed.x, y: parsed.y } : undefined;

    // "normal" restores the remembered rect; explicit size or position still wins.
    const restored = parsed.state === 'normal' ? normalRects.get(driver) : undefined;
    if (parsed.state === 'normal') normalRects.delete(driver);
    const rect: Partial<Rect> = { ...(restored ?? {}), ...(size ?? {}), ...(position ?? {}) };

    if (Object.keys(rect).length === 0) {
      // normal without anything remembered: setting the current rect leaves fullscreen/minimized.
      Object.assign(rect, await window.getRect());
    }
    // Setting the rect also leaves fullscreen, maximized and minimized (WebDriver spec).
    await window.setRect(rect);

    const now = await window.getRect().catch(() => undefined);
    const label = parsed.preset
      ? `${parsed.preset} (${rect.width}x${rect.height})`
      : now
        ? `${now.width}x${now.height} at ${now.x},${now.y}`
        : `${rect.width ?? '?'}x${rect.height ?? '?'}`;
    return this.success(
      parsed.state === 'normal' ? `Window restored to ${label}` : `Window ${size ? 'resized' : 'moved'} to ${label}`,
      false
    );
  }
}
