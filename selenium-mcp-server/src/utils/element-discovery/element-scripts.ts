import { WebDriver, WebElement } from 'selenium-webdriver';
import type { ElementInfo } from '../../types.js';
import { SELECTOR_COMPUTATION_CODE } from './selector-scripts.js';

/**
 * Browser-side script that computes a CSS/XPath selector for a single element.
 * Uses the shared SELECTOR_COMPUTATION_CODE.
 */
const COMPUTE_SELECTOR_SCRIPT = `
  ${SELECTOR_COMPUTATION_CODE}
  var el = arguments[0];
  return computeSelector(el);
`;

/**
 * Browser-side script that collects all attributes from an element dynamically.
 * Skips volatile/layout-only attrs. Returns a plain object of name→value pairs.
 */
const COLLECT_ATTRS_SCRIPT = `
  var el = arguments[0];
  var verbose = arguments[1];
  var cssSel = arguments[2];
  var ESSENTIAL = { 'id':1, 'name':1, 'type':1, 'role':1, 'data-testid':1, 'data-test':1, 'data-cy':1, 'data-qa':1 };
  var result = {};
  var attrs = el.attributes;
  var winner = null;
  if (cssSel) {
    var m = cssSel.match(/\\[([a-zA-Z][a-zA-Z0-9_-]*)(?:[\\^\\$\\*]?=)/);
    if (m) winner = m[1];
  }
  for (var i = 0; i < attrs.length; i++) {
    var name = attrs[i].name;
    var val = attrs[i].value;
    if (name === 'style' || name === 'class' || name === 'slot') continue;
    if (name.indexOf('on') === 0 && name.length > 2) continue;
    if (name === 'data-reactid' || name === 'data-reactroot' || name === 'data-react-checksum') continue;
    if (!val || val.length > 200) continue;
    if (!verbose && !ESSENTIAL[name] && name !== winner) continue;
    result[name] = val;
  }
  return result;
`;

export async function extractElementInfo(
  el: WebElement,
  ref: string,
  verboseAttributes: boolean = false,
): Promise<ElementInfo> {
  const tagName = await el.getTagName();
  const text = await el.getText();
  const ariaLabel = await el.getAttribute('aria-label');
  const role = await el.getAttribute('role');

  // Compute CSS/XPath selector in-browser first (needed for attr filtering)
  let css: string | undefined;
  let xpath: string | undefined;
  try {
    const selectorResult = await el.getDriver().executeScript(COMPUTE_SELECTOR_SCRIPT, el) as {
      css: string | null;
      xpath: string | null;
    };
    css = selectorResult.css || undefined;
    xpath = selectorResult.xpath || undefined;
  } catch {
    // Selector computation is non-critical
  }

  // Collect attributes (filtered by verbose flag + winning CSS selector)
  const attributes = await el.getDriver().executeScript(
    COLLECT_ATTRS_SCRIPT, el, verboseAttributes, css || null,
  ) as Record<string, string> ?? {};

  const rect = await el.getRect();
  const isClickable = ['a', 'button', 'input'].includes(tagName.toLowerCase()) ||
                      (await el.getAttribute('onclick')) !== null ||
                      role === 'button';

  return {
    ref,
    tagName,
    role: role || tagName.toLowerCase(),
    text: text.slice(0, 100),
    ariaLabel: ariaLabel || undefined,
    isClickable,
    isVisible: true,
    attributes,
    css,
    xpath,
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

  // Shadow DOM helper: resolve "hostSelector >>> innerSelector" paths
  function queryShadow(cssPath) {
    var parts = cssPath.split(' >>> ');
    if (parts.length < 2) return document.querySelector(parts[0]);
    var current = document;
    for (var i = 0; i < parts.length; i++) {
      try {
        var el = current.querySelector(parts[i]);
        if (!el) return null;
        if (i < parts.length - 1) {
          if (!el.shadowRoot) return null;
          current = el.shadowRoot;
        } else {
          return el;
        }
      } catch (_) { return null; }
    }
    return null;
  }

  // 0. By stored CSS selector (handles shadow DOM >>> paths)
  if (info.css) {
    try {
      var el = info.css.indexOf(' >>> ') !== -1 ? queryShadow(info.css) : document.querySelector(info.css);
      if (el && isVisible(el)) return el;
    } catch (_) {}
  }

  // 1. By ID (most stable)
  if (attrs.id) {
    var el = document.getElementById(attrs.id);
    if (el && isVisible(el)) return el;
  }

  // 2. Dynamic attribute lookup — try each stored attribute as a selector
  //    Priority order: test IDs first, then all others
  var priorityAttrs = ['data-testid', 'data-test', 'data-cy', 'data-qa', 'name', 'aria-label',
    'placeholder', 'alt', 'title', 'datetime', 'for', 'src', 'action', 'href',
    'formaction', 'formcontrolname', 'ng-model', 'v-model', 'data-bind'];
  var triedAttrs = { 'id': true };
  for (var pai = 0; pai < priorityAttrs.length; pai++) {
    var pa = priorityAttrs[pai];
    triedAttrs[pa] = true;
    if (attrs[pa]) {
      try {
        var sel = tag + '[' + pa + '="' + attrs[pa].replace(/"/g, '\\\\"') + '"]';
        var el = document.querySelector(sel);
        if (el && isVisible(el)) return el;
        // Also try without tag prefix (for data-* attrs)
        if (pa.indexOf('data-') === 0) {
          el = document.querySelector('[' + pa + '="' + attrs[pa].replace(/"/g, '\\\\"') + '"]');
          if (el && isVisible(el)) return el;
        }
      } catch (_) {}
    }
  }
  // Try remaining dynamic attributes
  var attrKeys = Object.keys(attrs);
  for (var aki = 0; aki < attrKeys.length; aki++) {
    var ak = attrKeys[aki];
    if (triedAttrs[ak] || ak === 'type') continue; // type handled separately below
    try {
      var sel = tag + '[' + ak + '="' + attrs[ak].replace(/"/g, '\\\\"') + '"]';
      var el = document.querySelector(sel);
      if (el && isVisible(el)) return el;
    } catch (_) {}
  }

  // 3. By aria-label from info (may differ from attrs)
  if (info.ariaLabel) {
    var el = document.querySelector('[aria-label="' + info.ariaLabel.replace(/"/g, '\\\\"') + '"]');
    if (el && isVisible(el)) return el;
  }

  // 4. By tag + type attribute with text verification
  if (attrs.type) {
    var candidates = document.querySelectorAll(tag + '[type="' + attrs.type + '"]');
    for (var i = 0; i < candidates.length; i++) {
      if (isVisible(candidates[i])) {
        if (info.text) {
          var ct = (candidates[i].textContent || '').trim();
          if (ct.indexOf(info.text.slice(0, 30)) !== -1) return candidates[i];
        } else {
          return candidates[i];
        }
      }
    }
  }

  // 5. By text content
  if (info.text && ['a', 'button', 'label', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'td', 'th', 'img', 'nav', 'main', 'header', 'footer', 'aside', 'section', 'form', 'details', 'summary'].indexOf(tag) !== -1) {
    var needle = info.text.slice(0, 30);
    var candidates = document.querySelectorAll(tag);
    for (var i = 0; i < candidates.length; i++) {
      if (isVisible(candidates[i])) {
        var ct = (candidates[i].textContent || '').trim();
        if (ct.indexOf(needle) !== -1) return candidates[i];
      }
    }
  }

  // 6. Position fallback — find closest element by bounding box
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
