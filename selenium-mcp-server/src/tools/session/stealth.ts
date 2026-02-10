import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  enabled: z.boolean().describe('Enable (true) or disable (false) stealth mode'),
});

export class SetStealthModeTool extends BaseTool {
  readonly name = 'set_stealth_mode';
  readonly description =
    'Enable or disable stealth mode for undetected browsing. ' +
    'Hides automation indicators like navigator.webdriver to avoid bot detection. ' +
    'If the browser is already running it will be restarted with the new setting.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'session';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { enabled } = this.parseParams(schema, params);

    const wasEnabled = context.getStealthEnabled();

    context.setStealthEnabled(enabled);

    // If the setting actually changed and the browser is already running, restart it
    if (enabled !== wasEnabled && context.isBrowserRunning()) {
      await context.reset();
      return this.success(
        `Stealth mode ${enabled ? 'enabled' : 'disabled'}. Browser restarted with new settings.`,
        false,
      );
    }

    return this.success(
      `Stealth mode ${enabled ? 'enabled' : 'disabled'}.` +
        (context.isBrowserRunning() ? '' : ' Will take effect when the browser starts.'),
      false,
    );
  }
}
