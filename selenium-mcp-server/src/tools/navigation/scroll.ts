import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  direction: z.enum(['up', 'down', 'left', 'right']).optional().describe('Scroll direction (required unless selector is provided)'),
  amount: z.coerce.number().optional().describe('Pixels to scroll (default 500)'),
  selector: z.string().optional().describe('CSS selector to scroll into view (ignores direction/amount when provided)'),
}).refine(
  (data) => data.selector !== undefined || data.direction !== undefined,
  { message: 'Either "direction" or "selector" must be provided', path: ['direction'] }
);

export class ScrollPageTool extends BaseTool {
  readonly name = 'scroll_page';
  readonly description = 'Scroll the page in a direction by a pixel amount, or scroll a specific element into view using a CSS selector.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'navigation';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { direction, amount, selector } = this.parseParams(schema, params);

    const driver = await context.ensureBrowser();

    if (selector) {
      const element = await driver.findElement({ css: selector });
      await driver.executeScript(
        "arguments[0].scrollIntoView({ block: 'center', behavior: 'auto' })",
        element
      );
    } else {
      const px = amount ?? 500;
      const dx = direction === 'right' ? px : direction === 'left' ? -px : 0;
      const dy = direction === 'down' ? px : direction === 'up' ? -px : 0;
      await driver.executeScript(`window.scrollBy(${dx}, ${dy})`);
    }

    const [scrollX, scrollY] = await driver.executeScript<[number, number]>(
      'return [window.scrollX, window.scrollY]'
    );

    const action = selector ? `Scrolled "${selector}" into view` : `Scrolled ${direction} by ${amount ?? 500}px`;
    return this.success(`${action} — scroll position: (${scrollX}, ${scrollY})`, true);
  }
}
