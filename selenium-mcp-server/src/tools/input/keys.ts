import { z } from 'zod';
import { Key } from 'selenium-webdriver';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const keyMap: Record<string, string> = {
  'enter': Key.ENTER,
  'return': Key.RETURN,
  'tab': Key.TAB,
  'escape': Key.ESCAPE,
  'esc': Key.ESCAPE,
  'backspace': Key.BACK_SPACE,
  'delete': Key.DELETE,
  'space': Key.SPACE,
  'up': Key.UP,
  'down': Key.DOWN,
  'left': Key.LEFT,
  'right': Key.RIGHT,
  'home': Key.HOME,
  'end': Key.END,
  'pageup': Key.PAGE_UP,
  'pagedown': Key.PAGE_DOWN,
  'f1': Key.F1,
  'f2': Key.F2,
  'f3': Key.F3,
  'f4': Key.F4,
  'f5': Key.F5,
  'f6': Key.F6,
  'f7': Key.F7,
  'f8': Key.F8,
  'f9': Key.F9,
  'f10': Key.F10,
  'f11': Key.F11,
  'f12': Key.F12
};

const schema = z.object({
  key: z.string().describe('Key to press (e.g., "enter", "tab", "escape", "backspace", "up", "down")'),
  ref: z.string().optional().describe('Element reference to send key to (optional, sends to active element if not specified)'),
  modifiers: z.array(z.enum(['ctrl', 'alt', 'shift', 'meta'])).optional().describe('Modifier keys to hold')
});

export class KeyPressTool extends BaseTool {
  readonly name = 'key_press';
  readonly description = 'Press a keyboard key, optionally with modifiers (ctrl, alt, shift, meta)';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'input';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { key, ref, modifiers } = this.parseParams(schema, params);

    const driver = await context.getDriver();
    const actions = driver.actions({ async: true });

    // Get the key to press
    const keyToPress = keyMap[key.toLowerCase()] || key;

    // Add modifier keys
    if (modifiers?.includes('ctrl')) {
      actions.keyDown(Key.CONTROL);
    }
    if (modifiers?.includes('alt')) {
      actions.keyDown(Key.ALT);
    }
    if (modifiers?.includes('shift')) {
      actions.keyDown(Key.SHIFT);
    }
    if (modifiers?.includes('meta')) {
      actions.keyDown(Key.META);
    }

    // If ref provided, click on element first
    if (ref) {
      const element = await context.getElementByRef(ref);
      await element.click();
    }

    // Press the key
    actions.sendKeys(keyToPress);

    // Release modifier keys
    if (modifiers?.includes('meta')) {
      actions.keyUp(Key.META);
    }
    if (modifiers?.includes('shift')) {
      actions.keyUp(Key.SHIFT);
    }
    if (modifiers?.includes('alt')) {
      actions.keyUp(Key.ALT);
    }
    if (modifiers?.includes('ctrl')) {
      actions.keyUp(Key.CONTROL);
    }

    await actions.perform();

    const modifierStr = modifiers?.length ? `${modifiers.join('+')}+` : '';
    return this.success(`Pressed ${modifierStr}${key}`, true);
  }
}
