import { z } from 'zod';
import { By } from 'selenium-webdriver';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  items: z.array(z.string()).describe('List of text items that should be visible')
});

export class VerifyListVisibleTool extends BaseTool {
  readonly name = 'verify_list_visible';
  readonly description = 'Verify that multiple text items are visible on the page';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { items } = this.parseParams(schema, params);

    const driver = await context.getDriver();
    const results: { item: string; verified: boolean; error?: string }[] = [];
    let allVerified = true;

    for (const item of items) {
      try {
        const elements = await driver.findElements(
          By.xpath(`//*[contains(text(), '${item.replace(/'/g, "\\'")}')]`)
        );

        let found = false;
        for (const el of elements) {
          try {
            if (await el.isDisplayed()) {
              found = true;
              break;
            }
          } catch {
            // Element might be stale
          }
        }

        if (found) {
          results.push({ item, verified: true });
        } else {
          results.push({ item, verified: false });
          allVerified = false;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ item, verified: false, error: message });
        allVerified = false;
      }
    }

    const verifiedCount = results.filter(r => r.verified).length;
    const summary = results.map(r =>
      `  ${r.verified ? '✓' : '✗'} "${r.item}"${r.error ? ` (${r.error})` : ''}`
    ).join('\n');

    if (allVerified) {
      return this.success(`All ${items.length} items verified:\n${summary}`, false);
    } else {
      return this.error(`Verified ${verifiedCount}/${items.length} items:\n${summary}`);
    }
  }
}
