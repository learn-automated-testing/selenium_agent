import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { stateDeep } from '../../utils/shadow-dom.js';

const schema = z.object({
  ref: z.string().describe('Element reference from page snapshot'),
  expectedValue: z.string().describe('Expected value of the element'),
});

export class VerifyValueTool extends BaseTool {
  readonly name = 'verify_value';
  readonly description = 'Verify that an element has the expected value or text content';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'verification';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { ref, expectedValue } = this.parseParams(schema, params);

    try {
      const target = await context.getTargetByRef(ref);
      let actualValue: string;
      if (target.element) {
        actualValue = await target.element.getAttribute('value') || await target.element.getText();
      } else {
        // Shadow DOM WebDriver cannot reach: read the value / text in the page.
        const state = await stateDeep(await context.getDriver(), target.selector);
        actualValue = state?.value || state?.text || '';
      }

      if (actualValue === expectedValue) {
        return this.success(`Element ${ref} has expected value "${expectedValue}"`, false);
      } else {
        return this.error(`Value mismatch for ${ref}: expected "${expectedValue}", got "${actualValue}"`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Could not verify value for ${ref}: ${message}`);
    }
  }
}
