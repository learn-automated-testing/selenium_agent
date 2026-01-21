import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  ref: z.string().describe('Element reference from page snapshot'),
  expectedValue: z.string().describe('Expected value of the element')
});

export class VerifyValueTool extends BaseTool {
  readonly name = 'verify_value';
  readonly description = 'Verify that an input element has the expected value';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { ref, expectedValue } = this.parseParams(schema, params);

    try {
      const element = await context.getElementByRef(ref);
      const actualValue = await element.getAttribute('value') || await element.getText();

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
