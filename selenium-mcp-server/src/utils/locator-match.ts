import type { WebDriver } from 'selenium-webdriver';
import { DEEP_QUERY, shadowSnippets } from './shadow-dom.js';
import { deepCallSnippets } from './shadow-helpers.js';

/** One interactive element as the page reports it, with the text around it for context. */
export interface LocatorCandidate {
  tag: string;
  role: string;
  type: string;
  text: string;
  label: string;
  placeholder: string;
  name: string;
  id: string;
  testId: string;
  context: string;
  css: string;
  xpath: string;
  /**
   * True for elements behind a shadow-DOM polyfill (Salesforce Lightning / LWC synthetic shadow): WebDriver can
   * neither find them nor open their shadow root, so tests reach them through the deep_shadow helper.
   */
  syntheticShadow?: boolean;
  /** True when another element (e.g. an open dialog) lies over its centre, so a user could not click it now. */
  covered?: boolean;
}

export interface LocatorMatch extends LocatorCandidate {
  score: number;
}

/**
 * Runs in the page (plain JavaScript). Lists visible interactive elements with a stable
 * selector each (test id, id, name, or a positional path) and the text of the nearest
 * container, so "the Add to Cart button of the Keyboard" can be told apart.
 */
const COLLECT_CANDIDATES = `${DEEP_QUERY}
const visible = (el) => {
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
};
const clean = (t) => (t || '').replace(/\\s+/g, ' ').trim();
const q = (v) => '"' + String(v).replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"') + '"';
const unique = (sel, root) => { try { return root.querySelectorAll(sel).length === 1; } catch (e) { return false; } };
const pathOf = (el) => {
  const parts = [];
  for (let n = el; n && n.nodeType === 1 && n !== document.body; n = n.parentElement) {
    let i = 1;
    for (let s = n.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === n.tagName) i++;
    parts.unshift(n.tagName.toLowerCase() + ':nth-of-type(' + i + ')');
  }
  return (el.getRootNode() === document ? 'body > ' : '') + parts.join(' > ');
};
// A selector that is unique within the element's own tree (the document or its shadow root).
const cssIn = (el) => {
  const root = el.getRootNode();
  const tag = el.tagName.toLowerCase();
  const testAttr = ['data-testid', 'data-test', 'data-qa'].find((a) => el.hasAttribute(a));
  const id = el.getAttribute('id');
  const name = el.getAttribute('name');
  if (testAttr && unique('[' + testAttr + '=' + q(el.getAttribute(testAttr)) + ']', root)) return '[' + testAttr + '=' + q(el.getAttribute(testAttr)) + ']';
  if (id && unique('#' + CSS.escape(id), root)) return '#' + CSS.escape(id);
  if (name && unique(tag + '[name=' + q(name) + ']', root)) return tag + '[name=' + q(name) + ']';
  // Web components (custom tags) and elements alone of their kind in a shadow root.
  if ((root !== document || tag.includes('-')) && unique(tag, root)) return tag;
  return pathOf(el);
};
const ICON = /(^|\\s)(material-(icons|symbols)[\\w-]*|mat-icon|fa|fas|far|fab|bi|glyphicon)(\\s|$)/;
const textOf = (el) => {
  let out = '';
  for (const n of el.childNodes) {
    if (n.nodeType === 3) out += n.textContent + ' ';
    else if (n.nodeType === 1 && n.getAttribute('aria-hidden') !== 'true' && !ICON.test(n.getAttribute('class') || '') && n.tagName !== 'OPTION') out += textOf(n) + ' ';
  }
  return clean(out);
};
const labelOf = (el) => {
  const id = el.getAttribute('id');
  const byFor = id ? el.getRootNode().querySelector('label[for="' + CSS.escape(id) + '"]') : null;
  const wrapping = el.closest('label');
  return clean(el.getAttribute('aria-label') || (byFor && textOf(byFor)) || (wrapping && textOf(wrapping)) || '');
};
const contextOf = (el) => {
  let n = el.parentElement;
  for (let depth = 0; n && depth < 4; depth++, n = n.parentElement) {
    const t = clean(n.textContent);
    if (t.length > clean(el.textContent).length + 2) return t.slice(0, 160);
  }
  return '';
};
// Native Node.contains from a fresh frame: shadow-DOM polyfills patch the page's own copy. A real shadow root keeps
// its elements out of the document tree; a polyfill (LWC synthetic shadow) leaves them in it.
const probe = document.createElement('iframe');
probe.style.display = 'none';
let nativeContains = null;
try { document.documentElement.appendChild(probe); nativeContains = probe.contentWindow.Node.prototype.contains; } catch (e) { nativeContains = null; }
const inPageTree = (el) => { try { return !!nativeContains && nativeContains.call(document.documentElement, el); } catch (e) { return false; } };
// For polyfilled shadow DOM the helper searches the whole page, shadow roots included, so a short selector unique
// across the page beats a long host chain with positions. Generated ids (input-123) change per page load: skipped.
const SHORT_ATTRS = ['data-testid', 'data-test', 'data-qa', 'name', 'title', 'aria-label', 'placeholder', 'data-value'];
// How often each tag[attr="value"] / #id occurs among the page's visible elements, shadow roots included (one pass).
// Visible only: the helper acts on the first visible match, and Salesforce keeps hidden copies of earlier pages.
let keyCounts = null;
const countKeys = () => {
  keyCounts = new Map();
  const add = (k) => keyCounts.set(k, (keyCounts.get(k) || 0) + 1);
  for (const e of deepQueryAll(document, '*')) {
    if (!e.getClientRects().length) continue;
    const tag = e.tagName.toLowerCase();
    for (const a of SHORT_ATTRS) { const v = e.getAttribute(a); if (v) add(tag + '[' + a + '=' + q(v) + ']'); }
    const id = e.getAttribute('id');
    if (id) add('#' + CSS.escape(id));
  }
};
const shortDeep = (el) => {
  if (!keyCounts) countKeys();
  const tag = el.tagName.toLowerCase();
  for (const a of SHORT_ATTRS) {
    const v = el.getAttribute(a);
    const sel = v ? tag + '[' + a + '=' + q(v) + ']' : '';
    if (sel && keyCounts.get(sel) === 1) return sel;
  }
  const id = el.getAttribute('id');
  if (id && !/\\d{2,}/.test(id) && keyCounts.get('#' + CSS.escape(id)) === 1) return '#' + CSS.escape(id);
  return '';
};
// Covered: the element at its centre (shadow roots entered) is neither the element nor inside it.
// Elements outside the viewport count as not covered: scrolling brings them into view.
const coveredAt = (el) => {
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
  let top = document.elementFromPoint(x, y);
  while (top && top.shadowRoot && top.shadowRoot.elementFromPoint) {
    const inner = top.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === top) break;
    top = inner;
  }
  for (let n = top; n; n = n.parentNode || n.host || null) if (n === el) return false;
  return !!top;
};
const els = deepQueryAll(document,
  'a[href], button, input, textarea, select, [role="button"], [role="link"], [role="checkbox"], [role="tab"], [role="menuitem"], [contenteditable="true"]'
).filter((el) => el.type !== 'hidden' && visible(el)).slice(0, 400);
const found = els.map((el) => {
  const tag = el.tagName.toLowerCase();
  const testAttr = ['data-testid', 'data-test', 'data-qa'].find((a) => el.hasAttribute(a));
  const testId = testAttr ? el.getAttribute(testAttr) : '';
  const id = el.getAttribute('id') || '';
  const name = el.getAttribute('name') || '';
  const hosts = shadowHosts(el);
  // Inside web components: "host >>> inner", as in Playwright (XPath cannot enter shadow roots).
  const synthetic = hosts.length > 0 && inPageTree(el);
  const css = (synthetic && shortDeep(el)) || hosts.map(cssIn).concat(cssIn(el)).join(' >>> ');
  const text = (textOf(el) || clean(el.value || '')).slice(0, 80);
  let xpath;
  if (hosts.length) xpath = '';
  else if (testId) xpath = '//' + tag + '[@' + testAttr + '=' + JSON.stringify(testId).replace(/^"|"$/g, "'") + ']';
  else if (text && !text.includes("'")) xpath = '//' + tag + "[normalize-space()='" + text + "']";
  else xpath = '';
  return {
    tag, role: el.getAttribute('role') || '', type: el.getAttribute('type') || '',
    text, label: labelOf(el), placeholder: el.getAttribute('placeholder') || '',
    name, id, testId, context: contextOf(el), css, xpath,
    syntheticShadow: synthetic,
    covered: coveredAt(el),
  };
});
probe.remove();
return found;
`;

export async function collectLocatorCandidates(driver: WebDriver): Promise<LocatorCandidate[]> {
  return driver.executeScript<LocatorCandidate[]>(COLLECT_CANDIDATES);
}

const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'for', 'to', 'on', 'in', 'at', 'with', 'and', 'or', 'that', 'this', 'which', 'is']);

/** Words in a description that say what KIND of element is meant. */
const KIND_WORDS: Record<string, (c: LocatorCandidate) => boolean> = {
  button: c => c.tag === 'button' || c.role === 'button' || ['submit', 'button'].includes(c.type),
  link: c => c.tag === 'a' || c.role === 'link',
  box: c => c.tag === 'textarea' || (c.tag === 'input' && !['checkbox', 'radio', 'submit', 'button'].includes(c.type)),
  field: c => ['input', 'textarea', 'select'].includes(c.tag),
  input: c => ['input', 'textarea'].includes(c.tag),
  textbox: c => c.tag === 'textarea' || c.tag === 'input',
  dropdown: c => c.tag === 'select' || c.role === 'listbox' || c.role === 'combobox',
  select: c => c.tag === 'select',
  checkbox: c => c.type === 'checkbox' || c.role === 'checkbox',
  toggle: c => c.type === 'checkbox' || c.role === 'switch',
  radio: c => c.type === 'radio' || c.role === 'radio',
  tab: c => c.role === 'tab',
};

function words(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(w => w && !STOP_WORDS.has(w));
}

/**
 * Score how well each candidate fits a plain-language description. Words found in the
 * element's own text, label, placeholder or test id count most; words found only in the
 * surrounding container count less; kind words ("button", "box") must fit the element.
 */
export function rankCandidates(description: string, candidates: LocatorCandidate[]): LocatorMatch[] {
  const all = words(description);
  const kinds = all.filter(w => KIND_WORDS[w]);
  const terms = all.filter(w => !KIND_WORDS[w]);
  const phrase = description.toLowerCase().replace(/\b(the|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();

  return candidates
    .map(c => {
      const own = words([c.text, c.label, c.placeholder, c.name, c.id, c.testId.replace(/[-_]/g, ' ')].join(' '));
      const around = words(c.context);
      let score = 0;
      for (const t of terms) {
        if (own.includes(t)) score += 2;
        else if (own.some(o => o.startsWith(t) || t.startsWith(o))) score += 1;
        else if (around.includes(t)) score += 1;
      }
      for (const k of kinds) {
        score += KIND_WORDS[k](c) ? 1.5 : -3;
        if (own.includes(k)) score += 1; // e.g. data-testid="cart-button" for "cart button"
      }
      const ownText = `${c.text} ${c.label} ${c.placeholder}`.toLowerCase();
      if (phrase && ownText.includes(phrase)) score += 3;
      // "Cancel" over "Cancel and close": an exact text or label match wins a tie.
      const kindless = all.filter(w => !KIND_WORDS[w]).join(' ');
      if (kindless && [c.text, c.label, c.placeholder].some(t => words(t).join(' ') === kindless)) score += 1;
      // Behind an open dialog: the user means what they can see and click now.
      if (c.covered) score -= 4;
      return { ...c, score };
    })
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Ready-to-paste locators with correct quoting per language. */
export function locatorSnippets(m: LocatorCandidate): Record<string, string> {
  const single = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const double = (s: string) => JSON.stringify(s);
  // A positional path breaks when the page layout changes; text-based XPath is sturdier then.
  if (m.syntheticShadow) {
    // Shadow-DOM polyfill (Salesforce Lightning): no WebDriver locator works, so the code calls the deep_shadow helper.
    return { recommended: m.css, css: m.css, ...deepCallSnippets(m.css) };
  }
  if (m.css.includes('>>>')) {
    // Inside shadow DOM: Selenium opens each host's shadow root and searches it with CSS.
    // SeleniumLibrary has no shadow-root keywords, so Robot Framework uses the helper.
    return { recommended: m.css, css: m.css, ...shadowSnippets(m.css), robot: deepCallSnippets(m.css).robot };
  }
  const positional = m.css.startsWith('body > ');
  const snippets: Record<string, string> = {
    recommended: positional && m.xpath ? m.xpath : m.css,
    css: m.css,
    javascript: `By.css(${single(m.css)})`,
    python: `(By.CSS_SELECTOR, ${single(m.css)})`,
    java: `By.cssSelector(${double(m.css)})`,
    robot: positional && m.xpath ? `xpath:${m.xpath}` : `css:${m.css}`,
  };
  if (m.xpath) {
    snippets.xpath = m.xpath;
    snippets.javascriptXpath = `By.xpath(${double(m.xpath)})`;
  }
  return snippets;
}
