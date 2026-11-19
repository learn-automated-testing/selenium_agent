import type { WebDriver } from 'selenium-webdriver';
import { DEEP_QUERY } from './shadow-dom.js';

export interface InventoryField {
  kind: string;
  label: string;
  name?: string;
  testId?: string;
  required?: boolean;
  options?: string[];
  /** The web component(s) the field is inside (open shadow DOM), e.g. "login-form". */
  shadowHost?: string;
}

export interface InventoryButton {
  label: string;
  testId?: string;
  disabled?: boolean;
  shadowHost?: string;
}

export interface InventoryLink {
  text: string;
  href: string;
  internal: boolean;
}

export interface PageInventory {
  /** "dialog" when a pop-up was open and only its contents were listed. */
  scope: 'page' | 'dialog';
  headings: string[];
  fields: InventoryField[];
  buttons: InventoryButton[];
  links: InventoryLink[];
  forms: Array<{ action: string; method: string; fields: number }>;
  totals: { fields: number; buttons: number; links: number; inShadowDom: number };
}

/**
 * Runs in the page (plain JavaScript, so it needs no DOM types here). Collects what a tester
 * needs to plan tests: headings, fields with their visible label, buttons, links and forms,
 * in one round trip. Only visible elements count; lists are capped so the result stays small.
 */
const COLLECT_INVENTORY = `${DEEP_QUERY}
const limit = arguments[0];
const visible = (el) => {
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
};
const clean = (t) => (t || '').replace(/\\s+/g, ' ').trim().slice(0, 80);
// Icon fonts put their glyph name in the text ("shopping_cart"): leave those out.
const ICON = /(^|\\s)(material-(icons|symbols)[\\w-]*|mat-icon|fa|fas|far|fab|bi|glyphicon)(\\s|$)/;
const textOf = (el) => {
  if (!el) return '';
  let out = '';
  for (const n of el.childNodes) {
    if (n.nodeType === 3) out += n.textContent + ' ';
    else if (n.nodeType === 1 && n.getAttribute('aria-hidden') !== 'true' && !ICON.test(n.getAttribute('class') || '') && n.tagName !== 'OPTION') out += textOf(n) + ' ';
  }
  return clean(out);
};
const human = (s) => clean((s || '').replace(/[-_]+/g, ' '));
const FIELDS = 'input, textarea, select';
const labelOf = (el) => {
  const id = el.getAttribute('id');
  const byFor = id ? el.getRootNode().querySelector('label[for="' + CSS.escape(id) + '"]') : null;
  const wrapping = el.closest('label');
  const labelledBy = el.getAttribute('aria-labelledby');
  const byAria = labelledBy ? el.getRootNode().querySelector('#' + CSS.escape(labelledBy.split(' ')[0])) : null;
  // An unlinked <label> right before the field, or the only label in a container with one field.
  let near = null;
  for (let p = el.previousElementSibling; p && !near; p = p.previousElementSibling) {
    if (p.tagName === 'LABEL') near = p;
    else if (p.matches(FIELDS) || p.querySelector(FIELDS)) break;
  }
  if (!near && el.parentElement && el.parentElement.querySelectorAll(FIELDS).length === 1) {
    near = el.parentElement.querySelector(':scope > label');
  }
  const isField = el.matches(FIELDS);
  return clean(
    el.getAttribute('aria-label') ||
    textOf(byFor) || textOf(byAria) || textOf(wrapping) || textOf(near) ||
    el.getAttribute('placeholder') ||
    el.getAttribute('title') ||
    (isField ? '' : textOf(el)) ||
    human(el.getAttribute('name')) ||
    human(el.getAttribute('data-testid') || el.getAttribute('data-test') || el.getAttribute('data-qa'))
  ).replace(/\\s*\\*$/, '');
};
// Elements inside web components: name the component(s) they are in.
const hostOf = (el) => shadowHosts(el).map((h) => h.tagName.toLowerCase()).join(' > ');
const testIdOf = (el) =>
  el.getAttribute('data-testid') || el.getAttribute('data-test') || el.getAttribute('data-qa') || undefined;

// While a pop-up is open, the page behind it does not count: look only inside the pop-up.
const coversScreen = (el) => {
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return s.position === 'fixed' && r.width >= innerWidth * 0.8 && r.height >= innerHeight * 0.8 && visible(el) &&
    el.querySelector('button, a[href], input, select, textarea');
};
const dialogs = deepQueryAll(document, 'dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]').filter(visible);
const overlays = deepQueryAll(document, 'body *').filter(coversScreen);
const root = dialogs[dialogs.length - 1] || overlays[overlays.length - 1] || document;
const inDialog = root !== document;

const fieldEls = deepQueryAll(root, 'input, textarea, select')
  .filter((el) => el.type !== 'hidden' && visible(el));
const buttonEls = Array.from(
  deepQueryAll(root, 'button, input[type="submit"], input[type="button"], [role="button"]')
).filter(visible);
const linkEls = deepQueryAll(root, 'a[href]').filter(visible);

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
    if (hostOf(el)) field.shadowHost = hostOf(el);
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
  if (hostOf(el)) button.shadowHost = hostOf(el);
  buttons.push(button);
  if (buttons.length >= limit) break;
}

const seenLinks = new Set();
const links = [];
for (const a of linkEls) {
  const text = clean(a.getAttribute('aria-label') || textOf(a));
  if (!text || seenLinks.has(a.href)) continue;
  seenLinks.add(a.href);
  links.push({ text, href: a.href, internal: a.host === location.host });
  if (links.length >= limit) break;
}

return {
  scope: inDialog ? 'dialog' : 'page',
  headings: Array.from(deepQueryAll(root, 'h1, h2, h3'))
    .filter(visible)
    .map((h) => h.tagName.toLowerCase() + ': ' + textOf(h))
    .slice(0, limit),
  fields,
  buttons,
  links,
  forms: Array.from(deepQueryAll(root, 'form')).map((f) => ({
    action: f.getAttribute('action') || '',
    method: (f.getAttribute('method') || 'GET').toUpperCase(),
    fields: f.querySelectorAll('input, textarea, select').length,
  })),
  totals: {
    fields: fieldEls.length, buttons: buttonEls.length, links: linkEls.length,
    inShadowDom: [...fieldEls, ...buttonEls, ...linkEls].filter((el) => el.getRootNode() instanceof ShadowRoot).length,
  },
};
`;

export async function getPageInventory(driver: WebDriver, limit = 40): Promise<PageInventory> {
  return driver.executeScript<PageInventory>(COLLECT_INVENTORY, limit);
}
