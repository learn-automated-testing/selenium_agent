import { z } from 'zod';
import { By } from 'selenium-webdriver';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  ref: z.string().describe('Element reference for select element'),
  value: z.string().optional().describe('Option value to select'),
  text: z.string().optional().describe('Option text to select'),
  index: z.number().optional().describe('Option index to select (0-based)')
});

export class SelectTool extends BaseTool {
  readonly name = 'select_option';
  readonly description = 'Select an option from a dropdown/select element by value, text, or index';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { ref, value, text, index } = this.parseParams(schema, params);

    if (!value && !text && index === undefined) {
      return this.error('Must provide value, text, or index to select');
    }

    const element = await context.getElementByRef(ref);
    const tagName = await element.getTagName();

    if (tagName.toLowerCase() !== 'select') {
      return this.error(`Element ${ref} is not a select element`);
    }

    if (value) {
      const option = await element.findElement(By.css(`option[value="${value}"]`));
      await option.click();
      return this.success(`Selected option with value "${value}"`, true);
    }

    if (text) {
      const options = await element.findElements(By.tagName('option'));
      for (const option of options) {
        const optionText = await option.getText();
        if (optionText === text) {
          await option.click();
          return this.success(`Selected option with text "${text}"`, true);
        }
      }
      return this.error(`Option with text "${text}" not found`);
    }

    if (index !== undefined) {
      const options = await element.findElements(By.tagName('option'));
      if (index < 0 || index >= options.length) {
        return this.error(`Index ${index} out of range (0-${options.length - 1})`);
      }
      await options[index].click();
      return this.success(`Selected option at index ${index}`, true);
    }

    return this.error('No selection criteria provided');
  }
}
