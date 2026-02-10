import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  ref: z.string().describe('Element reference (e.g., e1, e2) for input field'),
  text: z.string().describe('Text to type into the field'),
  clear: z.boolean().optional().default(true).describe('Clear existing text before typing')
});

export class TypeTool extends BaseTool {
  readonly name = 'input_text';
  readonly description = 'Type text into an input field or textarea';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'input';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { ref, text, clear } = this.parseParams(schema, params);

    const element = await context.getElementByRef(ref);

    if (clear) {
      await element.clear();
    }

    await element.sendKeys(text);

    return this.success(`Typed "${text.slice(0, 20)}${text.length > 20 ? '...' : ''}" into ${ref}`, true);
  }
}
