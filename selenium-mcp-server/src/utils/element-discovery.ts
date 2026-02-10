import { WebDriver, WebElement } from 'selenium-webdriver';
import { ElementInfo } from '../types.js';

const INTERACTIVE_SELECTORS = [
  'a', 'button', 'input', 'select', 'textarea',
  '[role="button"]', '[role="link"]', '[role="checkbox"]',
  '[role="radio"]', '[onclick]', '[tabindex]'
];

const MAX_ELEMENTS = 100;

/**
 * Browser-side JS that discovers all interactive elements in a single executeScript call.
 * Returns an array of plain objects matching ElementInfo shape.
 */
const DISCOVER_ELEMENTS_SCRIPT = `
  var scopeSelector = arguments[0];
  var selectors = arguments[1];
  var maxElements = arguments[2];

  var combinedSelector = scopeSelector
    ? selectors.map(function(s) { return scopeSelector + ' ' + s; }).join(', ')
    : selectors.join(', ');

  var els = document.querySelectorAll(combinedSelector);
  var results = [];
  var refCount = 1;

  for (var i = 0; i < els.length && results.length < maxElements; i++) {
    var el = els[i];

    // Skip hidden elements
    if (el.offsetParent === null && el.tagName.toLowerCase() !== 'body' &&
        window.getComputedStyle(el).display === 'none') continue;
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;

    var tagName = el.tagName.toLowerCase();
    var text = (el.textContent || '').trim().slice(0, 100);
    var ariaLabel = el.getAttribute('aria-label') || '';
    var id = el.getAttribute('id') || '';
    var name = el.getAttribute('name') || '';
    var type = el.getAttribute('type') || '';
    var href = el.getAttribute('href') || '';
    var placeholder = el.getAttribute('placeholder') || '';

    var isClickable = ['a', 'button', 'input'].indexOf(tagName) !== -1 ||
                      el.getAttribute('onclick') !== null ||
                      el.getAttribute('role') === 'button';

    var attributes = {};
    if (id) attributes['id'] = id;
    if (name) attributes['name'] = name;
    if (type) attributes['type'] = type;
    if (href) attributes['href'] = href;
    if (placeholder) attributes['placeholder'] = placeholder;

    results.push({
      ref: 'e' + (refCount++),
      tagName: tagName,
      text: text,
      ariaLabel: ariaLabel || null,
      isClickable: isClickable,
      isVisible: true,
      attributes: attributes,
      boundingBox: {
        x: rect.x + window.scrollX,
        y: rect.y + window.scrollY,
        width: rect.width,
        height: rect.height
      }
    });
  }

  return results;
`;

/**
 * Fast element discovery using a single executeScript call.
 * Replaces ~1000 HTTP round-trips with 1.
 */
export async function discoverElementsFast(
  driver: WebDriver,
  scopeSelector?: string
): Promise<Map<string, ElementInfo>> {
  const rawResults = await driver.executeScript(
    DISCOVER_ELEMENTS_SCRIPT,
    scopeSelector || null,
    INTERACTIVE_SELECTORS,
    MAX_ELEMENTS
  ) as Array<{
    ref: string;
    tagName: string;
    text: string;
    ariaLabel: string | null;
    isClickable: boolean;
    isVisible: boolean;
    attributes: Record<string, string>;
    boundingBox: { x: number; y: number; width: number; height: number };
  }>;

  const elements = new Map<string, ElementInfo>();
  for (const raw of rawResults) {
    elements.set(raw.ref, {
      ref: raw.ref,
      tagName: raw.tagName,
      text: raw.text,
      ariaLabel: raw.ariaLabel || undefined,
      isClickable: raw.isClickable,
      isVisible: raw.isVisible,
      attributes: raw.attributes,
      boundingBox: raw.boundingBox,
    });
  }

  return elements;
}

export async function discoverElements(
  driver: WebDriver,
  scopeSelector?: string
): Promise<Map<string, ElementInfo>> {
  return discoverElementsFast(driver, scopeSelector);
}

export async function extractElementInfo(el: WebElement, ref: string): Promise<ElementInfo> {
  const tagName = await el.getTagName();
  const text = await el.getText();
  const ariaLabel = await el.getAttribute('aria-label');
  const id = await el.getAttribute('id');
  const name = await el.getAttribute('name');
  const type = await el.getAttribute('type');
  const href = await el.getAttribute('href');
  const placeholder = await el.getAttribute('placeholder');

  const rect = await el.getRect();
  const isClickable = ['a', 'button', 'input'].includes(tagName.toLowerCase()) ||
                      (await el.getAttribute('onclick')) !== null ||
                      (await el.getAttribute('role')) === 'button';

  const attributes: Record<string, string> = {};
  if (id) attributes['id'] = id;
  if (name) attributes['name'] = name;
  if (type) attributes['type'] = type;
  if (href) attributes['href'] = href;
  if (placeholder) attributes['placeholder'] = placeholder;

  return {
    ref,
    tagName,
    text: text.slice(0, 100),
    ariaLabel: ariaLabel || undefined,
    isClickable,
    isVisible: true,
    attributes,
    boundingBox: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    }
  };
}

/**
 * Browser-side JS that finds an element using Playwright-inspired locator resolution.
 * Tries all strategies in one call and returns the matched DOM element directly.
 * Strategies (in priority order): id → data-testid → name → aria-label →
 * placeholder → role+text → tag+text (full descendant text) → position.
 */
const FIND_ELEMENT_SCRIPT = `
  var info = arguments[0];
  var tag = info.tagName;
  var attrs = info.attributes || {};
  var bbox = info.boundingBox;

  function isVisible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    var s = window.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  }

  // 1. By ID (most stable)
  if (attrs.id) {
    var el = document.getElementById(attrs.id);
    if (el && isVisible(el)) return el;
  }

  // 2. By data-testid
  if (attrs['data-testid']) {
    var el = document.querySelector('[data-testid="' + attrs['data-testid'] + '"]');
    if (el && isVisible(el)) return el;
  }

  // 3. By name attribute
  if (attrs.name) {
    var el = document.querySelector('[name="' + attrs.name + '"]');
    if (el && isVisible(el)) return el;
  }

  // 4. By aria-label
  if (info.ariaLabel) {
    var el = document.querySelector('[aria-label="' + info.ariaLabel + '"]');
    if (el && isVisible(el)) return el;
  }

  // 5. By placeholder (for inputs)
  if (attrs.placeholder) {
    var el = document.querySelector(tag + '[placeholder="' + attrs.placeholder + '"]');
    if (el && isVisible(el)) return el;
  }

  // 6. By tag + type attribute (e.g. button[type="submit"], input[type="email"])
  if (attrs.type) {
    var candidates = document.querySelectorAll(tag + '[type="' + attrs.type + '"]');
    for (var i = 0; i < candidates.length; i++) {
      if (isVisible(candidates[i])) {
        // If there's text to match, verify it too
        if (info.text) {
          var ct = (candidates[i].textContent || '').trim();
          if (ct.indexOf(info.text.slice(0, 30)) !== -1) return candidates[i];
        } else {
          return candidates[i];
        }
      }
    }
  }

  // 7. By text content — Playwright-style: uses full descendant textContent, not XPath text()
  if (info.text && ['a', 'button', 'label', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'td', 'th'].indexOf(tag) !== -1) {
    var needle = info.text.slice(0, 30);
    var candidates = document.querySelectorAll(tag);
    for (var i = 0; i < candidates.length; i++) {
      if (isVisible(candidates[i])) {
        var ct = (candidates[i].textContent || '').trim();
        if (ct.indexOf(needle) !== -1) return candidates[i];
      }
    }
  }

  // 8. By href (for links)
  if (attrs.href && tag === 'a') {
    var candidates = document.querySelectorAll('a[href]');
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i].getAttribute('href') === attrs.href && isVisible(candidates[i])) {
        return candidates[i];
      }
    }
  }

  // 9. Position fallback — find closest element by bounding box
  if (bbox) {
    var candidates = document.querySelectorAll(tag);
    var bestEl = null;
    var bestDist = Infinity;
    for (var i = 0; i < candidates.length; i++) {
      if (!isVisible(candidates[i])) continue;
      var r = candidates[i].getBoundingClientRect();
      var dx = (r.x + window.scrollX) - bbox.x;
      var dy = (r.y + window.scrollY) - bbox.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist && dist < 50) {
        bestDist = dist;
        bestEl = candidates[i];
      }
    }
    if (bestEl) return bestEl;
  }

  return null;
`;

export async function findElementByInfo(driver: WebDriver, info: ElementInfo): Promise<WebElement> {
  // Single executeScript call — Playwright-inspired locator resolution in-browser
  const el = await driver.executeScript(FIND_ELEMENT_SCRIPT, {
    tagName: info.tagName,
    text: info.text,
    ariaLabel: info.ariaLabel,
    attributes: info.attributes,
    boundingBox: info.boundingBox,
  }) as WebElement | null;

  if (el) return el;

  throw new Error(`Could not find element: ${info.ref} (${info.tagName})`);
}
