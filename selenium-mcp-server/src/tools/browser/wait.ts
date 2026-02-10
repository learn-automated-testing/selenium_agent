import { z } from 'zod';
import { until, By } from 'selenium-webdriver';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  condition: z.enum(['element_visible', 'element_clickable', 'element_present', 'url_contains', 'title_contains']).describe('Condition to wait for'),
  value: z.string().describe('Value for condition (element selector or text to match)'),
  timeout: z.number().optional().default(10000).describe('Timeout in milliseconds')
});

export class WaitTool extends BaseTool {
  readonly name = 'wait_for';
  readonly description = 'Wait for a condition to be met (element visible, URL contains, etc.)';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'wait';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { condition, value, timeout } = this.parseParams(schema, params);

    const driver = await context.getDriver();

    try {
      switch (condition) {
        case 'element_visible':
          await driver.wait(
            until.elementLocated(By.css(value)),
            timeout
          );
          const visibleEl = await driver.findElement(By.css(value));
          await driver.wait(until.elementIsVisible(visibleEl), timeout);
          break;

        case 'element_clickable':
          const clickableEl = await driver.wait(
            until.elementLocated(By.css(value)),
            timeout
          );
          await driver.wait(until.elementIsEnabled(clickableEl), timeout);
          break;

        case 'element_present':
          await driver.wait(
            until.elementLocated(By.css(value)),
            timeout
          );
          break;

        case 'url_contains':
          await driver.wait(until.urlContains(value), timeout);
          break;

        case 'title_contains':
          await driver.wait(until.titleContains(value), timeout);
          break;
      }

      return this.success(`Condition met: ${condition} "${value}"`, true);
    } catch (err) {
      return this.error(`Timeout waiting for ${condition} "${value}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
