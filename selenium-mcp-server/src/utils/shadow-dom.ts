import { Condition, type WebDriver, type WebElement } from 'selenium-webdriver';

/**
 * Shadow DOM support, the way Playwright does it: CSS selectors also match elements inside
 * open shadow roots ("piercing"), and `host >>> inner` addresses an element inside a
 * specific host. Closed shadow roots cannot be reached by any tool, as in Playwright.
 *
 * DEEP_QUERY is plain JavaScript that other in-page scripts include. It defines:
 *  - deepQueryAll(root, selector): matches in root and in every open shadow root below it
 *  - deepQuery(root, selector): the first match
 *  - queryPath(path): resolves "host >>> inner" (each part searched deep, from the previous host)
 *  - queryAllPath(path): all matches of the last part
 *  - shadowHosts(el): the chain of shadow hosts around an element, outermost first
 */
export const DEEP_QUERY = `
function deepQueryAll(root, selector) {
  const out = [];
  const visit = (r) => {
    for (const el of r.querySelectorAll(selector)) out.push(el);
    for (const el of r.querySelectorAll('*')) if (el.shadowRoot) visit(el.shadowRoot);
  };
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
    roots = found.filter((el) => el.shadowRoot).map((el) => el.shadowRoot);
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
`;

const FIND_ALL = `${DEEP_QUERY}
try { return queryAllPath(arguments[0]); } catch (e) { return []; }`;

const COUNT = `${DEEP_QUERY}
try { return queryAllPath(arguments[0]).length; } catch (e) { return -1; }`;

/** All elements matching a CSS selector or `host >>> inner` path, shadow roots included. */
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
