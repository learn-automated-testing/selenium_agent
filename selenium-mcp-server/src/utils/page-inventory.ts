import type { WebDriver } from 'selenium-webdriver';

export interface InventoryField {
  kind: string;
  label: string;
  name?: string;
  testId?: string;
  required?: boolean;
  options?: string[];
}

export interface InventoryButton {
  label: string;
  testId?: string;
  disabled?: boolean;
}

export interface InventoryLink {
  text: string;
  href: string;
  internal: boolean;
}

export interface PageInventory {
  headings: string[];
  fields: InventoryField[];
  buttons: InventoryButton[];
  links: InventoryLink[];
  forms: Array<{ action: string; method: string; fields: number }>;
  totals: { fields: number; buttons: number; links: number };
}

/**
 * Runs in the page (plain JavaScript, so it needs no DOM types here). Collects what a tester
 * needs to plan tests: headings, fields with their visible label, buttons, links and forms,
 * in one round trip. Only visible elements count; lists are capped so the result stays small.
 */
const COLLECT_INVENTORY = `
const limit = arguments[0];
const visible = (el) => {
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
};
const clean = (t) => (t || '').replace(/\\s+/g, ' ').trim().slice(0, 80);
const labelOf = (el) => {
  const id = el.getAttribute('id');
  const byFor = id ? document.querySelector('label[for="' + CSS.escape(id) + '"]') : null;
  const wrapping = el.closest('label');
  const labelledBy = el.getAttribute('aria-labelledby');
  const byAria = labelledBy ? document.getElementById(labelledBy.split(' ')[0]) : null;
  return clean(
    el.getAttribute('aria-label') ||
    (byFor && byFor.textContent) ||
    (byAria && byAria.textContent) ||
    (wrapping && wrapping.textContent) ||
    el.getAttribute('placeholder') ||
    el.getAttribute('title') ||
    el.getAttribute('name') ||
    el.textContent
  );
};
const testIdOf = (el) =>
  el.getAttribute('data-testid') || el.getAttribute('data-test') || el.getAttribute('data-qa') || undefined;

const fieldEls = Array.from(document.querySelectorAll('input, textarea, select'))
  .filter((el) => el.type !== 'hidden' && visible(el));
const buttonEls = Array.from(
  document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]')
).filter(visible);
const linkEls = Array.from(document.querySelectorAll('a[href]')).filter(visible);

const fields = fieldEls
  .filter((el) => el.type !== 'submit' && el.type !== 'button')
  .slice(0, limit)
  .map((el) => {
    const field = {
      kind: el.tagName === 'SELECT' ? 'select' : el.tagName === 'TEXTAREA' ? 'textarea' : (el.type || 'text'),
      label: labelOf(el),
    };
    if (el.name) field.name = el.name;
    const testId = testIdOf(el);
    if (testId) field.testId = testId;
    if (el.required) field.required = true;
    if (el.tagName === 'SELECT') field.options = Array.from(el.options).slice(0, 12).map((o) => clean(o.textContent));
    return field;
  });

const seenButtons = new Set();
const buttons = [];
for (const el of buttonEls) {
  const label = labelOf(el) || clean(el.value);
  const testId = testIdOf(el);
  const key = label + '|' + (testId || '');
  if (!label || seenButtons.has(key)) continue;
  seenButtons.add(key);
  const button = { label };
  if (testId) button.testId = testId;
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') button.disabled = true;
  buttons.push(button);
  if (buttons.length >= limit) break;
}

const seenLinks = new Set();
const links = [];
for (const a of linkEls) {
  const text = clean(a.getAttribute('aria-label') || a.textContent);
  if (!text || seenLinks.has(a.href)) continue;
  seenLinks.add(a.href);
  links.push({ text, href: a.href, internal: a.host === location.host });
  if (links.length >= limit) break;
}

return {
  headings: Array.from(document.querySelectorAll('h1, h2, h3'))
    .filter(visible)
    .map((h) => h.tagName.toLowerCase() + ': ' + clean(h.textContent))
    .slice(0, limit),
  fields,
  buttons,
  links,
  forms: Array.from(document.forms).map((f) => ({
    action: f.getAttribute('action') || '',
    method: (f.getAttribute('method') || 'GET').toUpperCase(),
    fields: f.querySelectorAll('input, textarea, select').length,
  })),
  totals: { fields: fieldEls.length, buttons: buttonEls.length, links: linkEls.length },
};
`;

export async function getPageInventory(driver: WebDriver, limit = 40): Promise<PageInventory> {
  return driver.executeScript<PageInventory>(COLLECT_INVENTORY, limit);
}
