import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  ref: z.string().describe('Element reference (e.g., e1, e2) for input field'),
  text: z.string().describe('Text to type into the field'),
  clear: z.boolean().optional().default(true).describe('Clear existing text before typing')
});

/**
 * Browser-side script that waits for a listbox (identified by aria-controls)
 * to receive children.  Polls every 100 ms up to 1 s, then resolves regardless.
 */
const WAIT_FOR_SUGGESTIONS_SCRIPT = `
  var listboxId = arguments[0];
  var callback  = arguments[arguments.length - 1];
  var attempts  = 0;
  function check() {
    var lb = document.getElementById(listboxId);
    if (lb && lb.children.length > 0) {
      callback(true);
    } else if (attempts++ >= 10) {
      callback(false);
    } else {
      setTimeout(check, 100);
    }
  }
  check();
`;

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

    // For combobox inputs, wait briefly for async suggestions to load
    const role = await element.getAttribute('role');
    const ariaControls = await element.getAttribute('aria-controls');

    if (role === 'combobox' && ariaControls) {
      const driver = await context.getDriver();
      await driver.executeAsyncScript(WAIT_FOR_SUGGESTIONS_SCRIPT, ariaControls);
    }

    return this.success(`Typed "${text.slice(0, 20)}${text.length > 20 ? '...' : ''}" into ${ref}`, true);
  }
}
