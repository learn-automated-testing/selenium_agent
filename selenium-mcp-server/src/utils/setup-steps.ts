import { z } from 'zod';
import { By, Key, until, type WebDriver } from 'selenium-webdriver';
import { untilLocatedDeep } from './shadow-dom.js';

/**
 * Steps that prepare the app before exploring, e.g. a login. They run in the same browser
 * the planner explores with, so the session (cookies, local storage) carries over.
 * Selectors are CSS, so steps can be written before any snapshot exists.
 */
export const setupStepSchema = z.object({
  action: z.enum(['navigate', 'fill', 'click', 'select', 'press', 'wait']),
  selector: z.string().optional().describe('CSS selector (fill, click, select, wait; press: optional target)'),
  value: z
    .string()
    .optional()
    .describe('fill: text to type; select: visible option text; press: key name (Enter, Tab, Escape); navigate: URL'),
  timeoutMs: z.coerce.number().optional().describe('How long to wait for the element (default 10000)'),
});

export type SetupStep = z.infer<typeof setupStepSchema>;

export interface SetupStepResult {
  step: number;
  action: SetupStep['action'];
  target?: string;
  ok: boolean;
  error?: string;
}

const KEYS: Record<string, string> = {
  enter: Key.ENTER,
  return: Key.RETURN,
  tab: Key.TAB,
  escape: Key.ESCAPE,
  esc: Key.ESCAPE,
  space: Key.SPACE,
  backspace: Key.BACK_SPACE,
};

async function find(driver: WebDriver, selector: string, timeoutMs: number) {
  const element = (await driver.wait(untilLocatedDeep(selector), timeoutMs, `No element matches ${selector}`))!;
  await driver.wait(until.elementIsVisible(element), timeoutMs, `${selector} is not visible`);
  return element;
}

async function runStep(driver: WebDriver, step: SetupStep): Promise<void> {
  const timeout = step.timeoutMs ?? 10000;
  const need = (field: 'selector' | 'value') => {
    const v = step[field];
    if (!v) throw new Error(`"${step.action}" needs a ${field}`);
    return v;
  };
  switch (step.action) {
    case 'navigate':
      await driver.get(need('value'));
      return;
    case 'fill': {
      const el = await find(driver, need('selector'), timeout);
      await el.clear();
      await el.sendKeys(step.value ?? '');
      return;
    }
    case 'click':
      await (await find(driver, need('selector'), timeout)).click();
      return;
    case 'select': {
      const el = await find(driver, need('selector'), timeout);
      const wanted = need('value');
      for (const option of await el.findElements(By.tagName('option'))) {
        if ((await option.getText()).trim() === wanted) {
          await option.click();
          return;
        }
      }
      throw new Error(`No option "${wanted}" in ${step.selector}`);
    }
    case 'press': {
      const key = KEYS[need('value').toLowerCase()] ?? step.value!;
      const target = step.selector ? await find(driver, step.selector, timeout) : await driver.switchTo().activeElement();
      await target.sendKeys(key);
      return;
    }
    case 'wait':
      await find(driver, need('selector'), timeout);
      return;
  }
}

/** Run the steps in order; stop at the first failure and report where it stopped. */
export async function runSetupSteps(driver: WebDriver, steps: SetupStep[]): Promise<SetupStepResult[]> {
  const results: SetupStepResult[] = [];
  for (const [i, step] of steps.entries()) {
    const target = step.selector ?? (step.action === 'navigate' ? step.value : undefined);
    try {
      await runStep(driver, step);
      results.push({ step: i + 1, action: step.action, ...(target ? { target } : {}), ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message.split('\n')[0] : String(err);
      results.push({ step: i + 1, action: step.action, ...(target ? { target } : {}), ok: false, error: message });
      break;
    }
  }
  return results;
}
