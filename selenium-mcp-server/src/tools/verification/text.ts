import { z } from 'zod';
import { By, until } from 'selenium-webdriver';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  text: z.string().describe('Text content to verify is visible on the page'),
  timeout: z.number().optional().default(10000).describe('Timeout in milliseconds')
});

export class VerifyTextVisibleTool extends BaseTool {
  readonly name = 'verify_text_visible';
  readonly description = 'Verify that specific text is visible on the page';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { text, timeout } = this.parseParams(schema, params);

    try {
      const driver = await context.getDriver();

      // Wait for text to be present
      await driver.wait(
        until.elementLocated(By.xpath(`//*[contains(text(), '${text.replace(/'/g, "\\'")}')]`)),
        timeout
      );

      // Check if visible
      const elements = await driver.findElements(
        By.xpath(`//*[contains(text(), '${text.replace(/'/g, "\\'")}')]`)
      );

      let visibleCount = 0;
      for (const el of elements) {
        try {
          if (await el.isDisplayed()) {
            visibleCount++;
          }
        } catch {
          // Element might be stale
        }
      }

      if (visibleCount > 0) {
        return this.success(`Text "${text}" is visible (found ${visibleCount} visible occurrence(s))`, false);
      } else {
        return this.error(`Text "${text}" exists but is not visible`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Text "${text}" not found: ${message}`);
    }
  }
}
