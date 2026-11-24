import { Condition, Key, Origin, type WebDriver, type WebElement } from 'selenium-webdriver';

/**
 * Shadow DOM support, the way Playwright does it: CSS selectors also match elements inside
 * open shadow roots ("piercing"), and `host >>> inner` addresses an element inside a
 * specific host. Closed shadow roots cannot be reached by any tool, as in Playwright.
 *
 * DEEP_QUERY is plain JavaScript that other in-page scripts include. It defines:
 *  - deepQueryAll(root, selector): matches in root (and, for an element, its own shadow root) and in every
 *    open shadow root below it
 *  - deepQuery(root, selector): the first match
 *  - queryPath(path): resolves "host >>> inner" (each part searched deep inside the previous match: its
 *    shadow root and its light-DOM children, so slotted content is found too)
 *  - queryAllPath(path): all matches of the last part
 *  - shadowHosts(el): the chain of shadow hosts around an element, outermost first
 *  - isShown(el): has a box and is not parked off the page (left of or above it). Salesforce keeps hidden
 *    copies of forms at about x = -9400: they have a box, but are not what the user sees.
 */
export const DEEP_QUERY = `
function deepQueryAll(root, selector) {
  const out = [];
  const visit = (r) => {
    for (const el of r.querySelectorAll(selector)) if (!out.includes(el)) out.push(el);
    for (const el of r.querySelectorAll('*')) if (el.shadowRoot) visit(el.shadowRoot);
  };
  if (root.shadowRoot) visit(root.shadowRoot);
  visit(root);
  return out;
}
function deepQuery(root, selector) { return deepQueryAll(root, selector)[0] || null; }
function queryAllPath(path) {
  const parts = String(path).split(/\\s*>>>\\s*/);
  let roots = [document];
  for (let i = 0; i < parts.length; i++) {
    const found = [];
    for (const r of roots) for (const el of deepQueryAll(r, parts[i])) if (!found.includes(el)) found.push(el);
    if (i === parts.length - 1) return found;
    roots = found;
    if (!roots.length) return [];
  }
  return [];
}
function queryPath(path) { return queryAllPath(path)[0] || null; }
function shadowHosts(el) {
  const hosts = [];
  for (let r = el.getRootNode(); r instanceof ShadowRoot; r = r.host.getRootNode()) hosts.unshift(r.host);
  return hosts;
}
function isShown(el) {
  if (!el.getClientRects().length) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.right + window.scrollX > 0 && r.bottom + window.scrollY > 0;
}
`;

const FIND_ALL = `${DEEP_QUERY}
try { return queryAllPath(arguments[0]); } catch (e) { return []; }`;

const COUNT = `${DEEP_QUERY}
try { return queryAllPath(arguments[0]).length; } catch (e) { return -1; }`;

/**
 * All elements matching a CSS selector or `host >>> inner` path, shadow roots included.
 * Note: on pages with a shadow-DOM polyfill (Salesforce Lightning's LWC "synthetic shadow") WebDriver cannot
 * use elements returned this way (they come back stale). Use the *Deep actions below for those.
 */
export async function findAllDeep(driver: WebDriver, selector: string): Promise<WebElement[]> {
  return (await driver.executeScript<WebElement[]>(FIND_ALL, selector)) ?? [];
}

/** Number of matches (shadow roots included), or -1 when the selector is invalid. */
export async function countDeep(driver: WebDriver, selector: string): Promise<number> {
  return driver.executeScript<number>(COUNT, selector);
}

/** Like until.elementLocated(By.css(selector)), but also inside open shadow roots. */
export function untilLocatedDeep(selector: string): Condition<WebElement | null> {
  return new Condition(`element matching ${selector}`, async (driver: WebDriver) => {
    const found = await findAllDeep(driver, selector);
    return found[0] ?? null;
  });
}

// ---------------------------------------------------------------------------------------------------------
// Real input at an element's position, for elements WebDriver cannot hold a reference to.
//
// Some component frameworks emulate shadow DOM in JavaScript (Salesforce Lightning / LWC "synthetic shadow").
// They patch the page's own query functions, so chromedriver can neither find those elements nor keep a
// reference to them: a WebElement returned from executeScript is stale at once, and getShadowRoot() reports
// "no such shadow root". These helpers locate the element in the page (deep query), scroll it into view,
// check that it is really the element on top at its centre, and then use WebDriver Actions at that point,
// so the browser gets real, trusted mouse and keyboard events, as with a normal WebElement.
// ---------------------------------------------------------------------------------------------------------

export interface DeepPoint {
  x: number;
  y: number;
  /** The element (or something inside it) is what is on top at (x, y): nothing covers it. */
  hit: boolean;
  tag: string;
}

const POINT = `${DEEP_QUERY}
var el;
try { el = queryAllPath(arguments[0]).filter(isShown)[0]; } catch (e) { return null; }
if (!el) return null;
el.scrollIntoView({ block: 'center', inline: 'center' });
var r = el.getBoundingClientRect();
var x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
var top = document.elementFromPoint(x, y);
while (top && top.shadowRoot && top.shadowRoot.elementFromPoint) {
  var inner = top.shadowRoot.elementFromPoint(x, y);
  if (!inner || inner === top) break;
  top = inner;
}
var hit = false;
for (var n = top; n; n = n.parentNode || n.host || null) { if (n === el) { hit = true; break; } }
return { x: x, y: y, hit: hit, tag: el.tagName.toLowerCase() };`;

const SELECT_CONTENT = `${DEEP_QUERY}
var el = queryAllPath(arguments[0]).filter(isShown)[0];
if (!el) return 0;
if (typeof el.select === 'function') { el.select(); return (el.value || '').length; }
if (el.isContentEditable) { var range = document.createRange(); range.selectNodeContents(el); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); return (el.textContent || '').length; }
return 0;`;

/** Scroll the first visible match into view and return its centre in viewport coordinates, or null. */
export async function pointDeep(driver: WebDriver, selector: string): Promise<DeepPoint | null> {
  return (await driver.executeScript<DeepPoint | null>(POINT, selector)) ?? null;
}

async function requirePoint(driver: WebDriver, selector: string): Promise<DeepPoint> {
  const point = await pointDeep(driver, selector);
  if (!point) throw new Error(`No visible element matches ${selector}`);
  if (!point.hit) {
    throw new Error(`Element ${selector} is covered by another element at (${point.x}, ${point.y}); ` +
      'close the overlay or wait until it is gone, then try again.');
  }
  return point;
}

/** Click with a real mouse event at the centre of the first visible match (shadow DOM included). */
export async function clickDeep(driver: WebDriver, selector: string, button: 'left' | 'right' = 'left'): Promise<DeepPoint> {
  const point = await requirePoint(driver, selector);
  const chain = driver.actions({ async: true }).move({ x: point.x, y: point.y, origin: Origin.VIEWPORT });
  await (button === 'right' ? chain.contextClick() : chain.click()).perform();
  return point;
}

/** Move the mouse to the centre of the first visible match (shadow DOM included). */
export async function hoverDeep(driver: WebDriver, selector: string): Promise<DeepPoint> {
  const point = await requirePoint(driver, selector);
  await driver.actions({ async: true }).move({ x: point.x, y: point.y, origin: Origin.VIEWPORT }).perform();
  return point;
}

/** Click into the first visible match and type with real key events, optionally replacing its content. */
export async function typeDeep(driver: WebDriver, selector: string, text: string, clear = true): Promise<DeepPoint> {
  const point = await clickDeep(driver, selector);
  if (clear) {
    const selected = await driver.executeScript<number>(SELECT_CONTENT, selector);
    if (selected > 0) await driver.actions({ async: true }).sendKeys(Key.BACK_SPACE).perform();
  }
  if (text) await driver.actions({ async: true }).sendKeys(text).perform();
  return point;
}

/** What the page shows for the first (visible) match: tag, value, text, visibility and position. */
export interface DeepState {
  tag: string;
  value: string | null;
  text: string;
  visible: boolean;
  rect: { x: number; y: number; width: number; height: number };
}

const STATE = `${DEEP_QUERY}
var all = queryAllPath(arguments[0]);
var el = all.filter(isShown)[0] || all[0];
if (!el) return null;
var s = getComputedStyle(el);
var visible = isShown(el) && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity || '1') > 0;
var r = el.getBoundingClientRect();
return { tag: el.tagName.toLowerCase(), value: typeof el.value === 'string' ? el.value : null,
  text: (el.innerText || el.textContent || '').trim(), visible: visible,
  rect: { x: r.x, y: r.y, width: r.width, height: r.height } };`;

export async function stateDeep(driver: WebDriver, selector: string): Promise<DeepState | null> {
  return (await driver.executeScript<DeepState | null>(STATE, selector)) ?? null;
}

/** How to pick an option: by value, visible text, or 0-based position. */
export interface OptionChoice { value?: string; text?: string; index?: number }

const SELECT_NATIVE = `${DEEP_QUERY}
var el = queryAllPath(arguments[0])[0], by = arguments[1];
if (!el || el.tagName.toLowerCase() !== 'select') return { error: 'not-select' };
var opts = Array.prototype.slice.call(el.options), i = -1;
if (by.value != null) i = opts.findIndex(function (o) { return o.value === by.value; });
else if (by.text != null) i = opts.findIndex(function (o) { return o.text.trim() === by.text; });
else if (by.index != null) i = by.index < opts.length ? by.index : -1;
if (i < 0) return { error: 'no-option', options: opts.map(function (o) { return o.text.trim(); }) };
el.selectedIndex = i;
el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
return { label: opts[i].text.trim() };`;

/** Choose an option of a native <select> that WebDriver cannot reach (shadow-DOM polyfill). */
export async function selectNativeDeep(driver: WebDriver, selector: string, choice: OptionChoice):
  Promise<{ label?: string; error?: 'not-select' | 'no-option'; options?: string[] }> {
  return driver.executeScript(SELECT_NATIVE, selector, choice);
}

// Finds a visible role="option" (dropdown list item, e.g. a Lightning picklist value) anywhere, shadow DOM included,
// scrolls it into view and returns its centre and whether a click there would land on it.
const OPTION_POINT = `${DEEP_QUERY}
var by = arguments[0];
var opts = deepQueryAll(document, '[role="option"]').filter(isShown);
function label(e) { return (e.innerText || e.textContent || '').trim().replace(/\\s+/g, ' '); }
var el = null;
if (by.value != null) el = opts.filter(function (e) { return e.getAttribute('data-value') === by.value || e.getAttribute('value') === by.value; })[0];
if (!el && by.text != null) {
  el = opts.filter(function (e) { return label(e) === by.text; })[0] ||
       opts.filter(function (e) { return label(e).toLowerCase() === by.text.toLowerCase(); })[0];
}
if (!el && by.value != null) el = opts.filter(function (e) { return label(e) === by.value; })[0];
if (!el && by.index != null) el = opts[by.index];
if (!el) return { found: false, options: opts.map(label) };
el.scrollIntoView({ block: 'nearest' });
var r = el.getBoundingClientRect();
var x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
var top = document.elementFromPoint(x, y);
while (top && top.shadowRoot && top.shadowRoot.elementFromPoint) {
  var inner = top.shadowRoot.elementFromPoint(x, y);
  if (!inner || inner === top) break;
  top = inner;
}
var hit = false;
for (var n = top; n; n = n.parentNode || n.host || null) { if (n === el) { hit = true; break; } }
return { found: true, x: x, y: y, hit: hit, label: label(el), options: [] };`;

interface OptionPoint { found: boolean; x?: number; y?: number; hit?: boolean; label?: string; options: string[] }

/**
 * Pick an item from an open dropdown list (role="option": Lightning picklists, ARIA comboboxes and listboxes)
 * with a real mouse click. Waits up to `timeout` ms for the option to show up.
 */
export async function clickOptionDeep(driver: WebDriver, choice: OptionChoice, timeout = 5000): Promise<string> {
  let last: OptionPoint = { found: false, options: [] };
  try {
    await driver.wait(async () => {
      last = await driver.executeScript<OptionPoint>(OPTION_POINT, choice);
      return last.found;
    }, timeout);
  } catch {
    const wanted = choice.text ?? choice.value ?? `#${choice.index}`;
    throw new Error(last.options.length
      ? `No option "${wanted}" in the list. Options shown: ${last.options.slice(0, 20).join(', ')}`
      : `No dropdown options appeared (looked for "${wanted}")`);
  }
  if (!last.hit) throw new Error(`Option "${last.label}" is covered by another element at (${last.x}, ${last.y})`);
  await driver.actions({ async: true }).move({ x: last.x!, y: last.y!, origin: Origin.VIEWPORT }).click().perform();
  return last.label!;
}

/** Something to act on: a WebElement WebDriver can use, or a deep selector for one it cannot. */
export interface PointTarget { element?: WebElement; selector?: string }

const ELEMENT_POINT = `var el = arguments[0];
el.scrollIntoView({ block: 'center', inline: 'center' });
var r = el.getBoundingClientRect();
return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), hit: true, tag: el.tagName.toLowerCase() };`;

async function pointOf(driver: WebDriver, target: PointTarget, checkHit: boolean): Promise<DeepPoint> {
  if (target.element) return driver.executeScript<DeepPoint>(ELEMENT_POINT, target.element);
  if (checkHit) return requirePoint(driver, target.selector!);
  const point = await pointDeep(driver, target.selector!);
  if (!point) throw new Error(`No visible element matches ${target.selector}`);
  return point;
}

/**
 * Drag with real mouse events: press on the source, move to the target in steps, release.
 * Used when either end is in shadow DOM that WebDriver cannot reach.
 */
export async function dragDeep(driver: WebDriver, source: PointTarget, target: PointTarget): Promise<void> {
  const from = await pointOf(driver, source, true);
  await driver.actions({ async: true }).move({ x: from.x, y: from.y, origin: Origin.VIEWPORT }).press().perform();
  try {
    const to = await pointOf(driver, target, false);
    await driver.actions({ async: true })
      .move({ x: Math.round((from.x + to.x) / 2), y: Math.round((from.y + to.y) / 2), origin: Origin.VIEWPORT, duration: 150 })
      .move({ x: to.x, y: to.y, origin: Origin.VIEWPORT, duration: 150 })
      .perform();
  } finally {
    await driver.actions({ async: true }).release().perform();
  }
}

/** False when WebDriver cannot use the element (stale reference, e.g. from a shadow-DOM polyfill). */
export async function isUsableElement(element: WebElement): Promise<boolean> {
  try {
    await element.getTagName();
    return true;
  } catch {
    return false;
  }
}

/**
 * Selenium code for a `host >>> inner` path: each host's shadow_root is opened in turn.
 * Selenium searches a shadow root with CSS only (no XPath), as browsers do.
 */
export function shadowSnippets(path: string): { python: string; java: string; javascript: string } {
  const parts = path.split(/\s*>>>\s*/);
  const sq = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const dq = (s: string) => JSON.stringify(s);
  let python = `driver.find_element(By.CSS_SELECTOR, ${sq(parts[0])})`;
  let java = `driver.findElement(By.cssSelector(${dq(parts[0])}))`;
  let javascript = `(await driver.findElement(By.css(${sq(parts[0])})))`;
  for (const part of parts.slice(1)) {
    python += `.shadow_root.find_element(By.CSS_SELECTOR, ${sq(part)})`;
    java += `.getShadowRoot().findElement(By.cssSelector(${dq(part)}))`;
    javascript = `(await (await ${javascript}.getShadowRoot()).findElement(By.css(${sq(part)})))`;
  }
  return { python, java, javascript: `await ${javascript.slice(7, -1)}` };
}
