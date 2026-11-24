import { z } from 'zod';
import { By } from 'selenium-webdriver';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { clickDeep, clickOptionDeep, selectNativeDeep, stateDeep, type OptionChoice } from '../../utils/shadow-dom.js';

const schema = z.object({
  ref: z.string().describe('Element reference for select element'),
  value: z.string().optional().describe('Option value to select'),
  text: z.string().optional().describe('Option text to select'),
  index: z.coerce.number().optional().describe('Option index to select (0-based)')
});

export class SelectTool extends BaseTool {
  readonly name = 'select_option';
  readonly description = 'Select an option from a dropdown by value, text, or index: a native <select>, or a dropdown list ' +
    '(combobox / picklist such as Salesforce Lightning), which is opened and the option clicked';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'interaction';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { ref, value, text, index } = this.parseParams(schema, params);

    if (!value && !text && index === undefined) {
      return this.error('Must provide value, text, or index to select');
    }

    const driver = await context.getDriver();
    const target = await context.getTargetByRef(ref);
    const choice: OptionChoice = value ? { value } : text ? { text } : { index };
    const tagName = target.element
      ? (await target.element.getTagName()).toLowerCase()
      : (await stateDeep(driver, target.selector))?.tag ?? '';

    if (tagName !== 'select') {
      // Dropdown list (combobox, Lightning picklist, listbox): open it, then click the option.
      try {
        if (target.element) await target.element.click();
        else await clickDeep(driver, target.selector);
        const label = await clickOptionDeep(driver, choice);
        return this.success(`Selected "${label}" in ${ref}`, true);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return this.error(`Element ${ref} is not a <select>, and picking from its dropdown list failed: ${message}`);
      }
    }

    if (!target.element) {
      // Native <select> in shadow DOM WebDriver cannot reach: set it in the page and fire input/change.
      const result = await selectNativeDeep(driver, target.selector, choice);
      if (result.error === 'no-option') {
        return this.error(`No matching option in ${ref}. Options: ${(result.options ?? []).join(', ')}`);
      }
      if (result.error) return this.error(`Element ${ref} is not a select element`);
      return this.success(`Selected option "${result.label}" (in shadow DOM, ${target.selector})`, true);
    }
    const element = target.element;

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
