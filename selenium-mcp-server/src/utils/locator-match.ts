import type { WebDriver } from 'selenium-webdriver';

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
}

export interface LocatorMatch extends LocatorCandidate {
  score: number;
}

/**
 * Runs in the page (plain JavaScript). Lists visible interactive elements with a stable
 * selector each (test id, id, name, or a positional path) and the text of the nearest
 * container, so "the Add to Cart button of the Keyboard" can be told apart.
 */
const COLLECT_CANDIDATES = `
const visible = (el) => {
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
};
const clean = (t) => (t || '').replace(/\\s+/g, ' ').trim();
const q = (v) => '"' + String(v).replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"') + '"';
const unique = (sel) => { try { return document.querySelectorAll(sel).length === 1; } catch (e) { return false; } };
const pathOf = (el) => {
  const parts = [];
  for (let n = el; n && n.nodeType === 1 && n !== document.body; n = n.parentElement) {
    let i = 1;
    for (let s = n.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === n.tagName) i++;
    parts.unshift(n.tagName.toLowerCase() + ':nth-of-type(' + i + ')');
  }
  return 'body > ' + parts.join(' > ');
};
const labelOf = (el) => {
  const id = el.getAttribute('id');
  const byFor = id ? document.querySelector('label[for="' + CSS.escape(id) + '"]') : null;
  const wrapping = el.closest('label');
  return clean(el.getAttribute('aria-label') || (byFor && byFor.textContent) || (wrapping && wrapping.textContent) || '');
};
const contextOf = (el) => {
  let n = el.parentElement;
  for (let depth = 0; n && depth < 4; depth++, n = n.parentElement) {
    const t = clean(n.textContent);
    if (t.length > clean(el.textContent).length + 2) return t.slice(0, 160);
  }
  return '';
};
const els = Array.from(document.querySelectorAll(
  'a[href], button, input, textarea, select, [role="button"], [role="link"], [role="checkbox"], [role="tab"], [role="menuitem"], [contenteditable="true"]'
)).filter((el) => el.type !== 'hidden' && visible(el)).slice(0, 400);
return els.map((el) => {
  const tag = el.tagName.toLowerCase();
  const testAttr = ['data-testid', 'data-test', 'data-qa'].find((a) => el.hasAttribute(a));
  const testId = testAttr ? el.getAttribute(testAttr) : '';
  const id = el.getAttribute('id') || '';
  const name = el.getAttribute('name') || '';
  let css = '';
  if (testId && unique('[' + testAttr + '=' + q(testId) + ']')) css = '[' + testAttr + '=' + q(testId) + ']';
  else if (id && unique('#' + CSS.escape(id))) css = '#' + CSS.escape(id);
  else if (name && unique(tag + '[name=' + q(name) + ']')) css = tag + '[name=' + q(name) + ']';
  else css = pathOf(el);
  const text = clean(el.textContent || el.value || '').slice(0, 80);
  let xpath;
  if (testId) xpath = '//' + tag + '[@' + testAttr + '=' + JSON.stringify(testId).replace(/^"|"$/g, "'") + ']';
  else if (text && !text.includes("'")) xpath = '//' + tag + "[normalize-space()='" + text + "']";
  else xpath = '';
  return {
    tag, role: el.getAttribute('role') || '', type: el.getAttribute('type') || '',
    text, label: labelOf(el), placeholder: el.getAttribute('placeholder') || '',
    name, id, testId, context: contextOf(el), css, xpath,
  };
});
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
  const positional = m.css.startsWith('body > ');
  const snippets: Record<string, string> = {
    recommended: positional && m.xpath ? m.xpath : m.css,
    css: m.css,
    javascript: `By.css(${single(m.css)})`,
    python: `(By.CSS_SELECTOR, ${single(m.css)})`,
    java: `By.cssSelector(${double(m.css)})`,
  };
  if (m.xpath) {
    snippets.xpath = m.xpath;
    snippets.javascriptXpath = `By.xpath(${double(m.xpath)})`;
  }
  return snippets;
}
