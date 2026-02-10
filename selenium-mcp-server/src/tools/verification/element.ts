import { z } from 'zod';
import { until } from 'selenium-webdriver';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  ref: z.string().describe('Element reference from page snapshot'),
  timeout: z.number().optional().default(10000).describe('Timeout in milliseconds')
});

export class VerifyElementVisibleTool extends BaseTool {
  readonly name = 'verify_element_visible';
  readonly description = 'Verify that an element is visible on the page';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'verification';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { ref, timeout } = this.parseParams(schema, params);

    try {
      const driver = await context.getDriver();
      const element = await context.getElementByRef(ref);

      await driver.wait(until.elementIsVisible(element), timeout);
      const isVisible = await element.isDisplayed();

      if (isVisible) {
        return this.success(`Element ${ref} is visible`, false);
      } else {
        return this.error(`Element ${ref} exists but is not visible`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Element ${ref} not found or not visible: ${message}`);
    }
  }
}
