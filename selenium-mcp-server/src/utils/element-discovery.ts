import { WebDriver, WebElement } from 'selenium-webdriver';
import { ElementInfo, AccessibilityNode } from '../types.js';

const MAX_ELEMENTS = 200;

/**
 * Browser-side JS that walks the DOM recursively, computes ARIA roles and
 * accessible names, assigns refs to semantic elements, and returns both a
 * flat element list and a hierarchical accessibility tree.
 */
const ACCESSIBILITY_TREE_SCRIPT = `
  var scopeSelector = arguments[0];
  var maxElements = arguments[1];

  // Implicit role map: tagName (+ optional attribute condition) → role
  var IMPLICIT_ROLES = {
    'a':        function(el) { return el.hasAttribute('href') ? 'link' : null; },
    'button':   function()   { return 'button'; },
    'input':    function(el) {
      var t = (el.getAttribute('type') || 'text').toLowerCase();
      var map = {
        'text':'textbox','search':'searchbox','email':'textbox','url':'textbox',
        'tel':'textbox','password':'textbox','number':'spinbutton',
        'checkbox':'checkbox','radio':'radio','range':'slider',
        'submit':'button','reset':'button','image':'button',
        'file':'button','color':'button'
      };
      return map[t] || 'textbox';
    },
    'select':   function()   { return 'combobox'; },
    'textarea': function()   { return 'textbox'; },
    'h1':       function()   { return 'heading'; },
    'h2':       function()   { return 'heading'; },
    'h3':       function()   { return 'heading'; },
    'h4':       function()   { return 'heading'; },
    'h5':       function()   { return 'heading'; },
    'h6':       function()   { return 'heading'; },
    'img':      function()   { return 'img'; },
    'nav':      function()   { return 'navigation'; },
    'main':     function()   { return 'main'; },
    'header':   function(el) { return !el.closest('article,aside,main,nav,section') ? 'banner' : null; },
    'footer':   function(el) { return !el.closest('article,aside,main,nav,section') ? 'contentinfo' : null; },
    'aside':    function()   { return 'complementary'; },
    'dialog':   function()   { return 'dialog'; },
    'form':     function()   { return 'form'; },
    'table':    function()   { return 'table'; },
    'ul':       function()   { return 'list'; },
    'ol':       function()   { return 'list'; },
    'li':       function()   { return 'listitem'; },
    'section':  function(el) { return el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby') ? 'region' : null; },
    'details':  function()   { return 'group'; },
    'summary':  function()   { return 'button'; },
    'progress': function()   { return 'progressbar'; },
    'meter':    function()   { return 'meter'; },
  };

  // Structural landmark roles that get refs even without a name
  var LANDMARK_ROLES = { 'navigation':1, 'main':1, 'banner':1, 'contentinfo':1, 'complementary':1, 'form':1 };

  function getRole(el) {
    // 1. Explicit role attribute
    var explicit = el.getAttribute('role');
    if (explicit) return explicit.split(' ')[0];

    var tag = el.tagName.toLowerCase();

    // 2. Implicit role from tag
    var fn = IMPLICIT_ROLES[tag];
    if (fn) {
      var r = fn(el);
      if (r) return r;
    }

    // 3. Interactive attributes
    if (el.getAttribute('contenteditable') === 'true') return 'textbox';
    if (el.hasAttribute('onclick') || el.hasAttribute('draggable')) return 'generic';
    if (el.hasAttribute('tabindex') && el.tabIndex >= 0) return 'generic';

    return null;
  }

  function getAccessibleName(el) {
    // 1. aria-label
    var ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();

    // 2. aria-labelledby
    var labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      var parts = labelledBy.split(/\\s+/);
      var texts = [];
      for (var i = 0; i < parts.length; i++) {
        var refEl = document.getElementById(parts[i]);
        if (refEl) texts.push((refEl.textContent || '').trim());
      }
      if (texts.length > 0) return texts.join(' ');
    }

    var tag = el.tagName.toLowerCase();

    // 3. alt for images
    if (tag === 'img' || tag === 'input' && (el.getAttribute('type') || '').toLowerCase() === 'image') {
      var alt = el.getAttribute('alt');
      if (alt) return alt.trim();
    }

    // 4. label[for] for form elements
    if (['input','select','textarea'].indexOf(tag) !== -1) {
      var id = el.getAttribute('id');
      if (id) {
        var label = document.querySelector('label[for="' + id + '"]');
        if (label) return (label.textContent || '').trim();
      }
      // Wrapping label
      var parentLabel = el.closest('label');
      if (parentLabel) {
        var clone = parentLabel.cloneNode(true);
        var inputs = clone.querySelectorAll('input,select,textarea');
        for (var i = 0; i < inputs.length; i++) inputs[i].remove();
        var lt = (clone.textContent || '').trim();
        if (lt) return lt;
      }
    }

    // 5. placeholder
    var ph = el.getAttribute('placeholder');
    if (ph) return ph.trim();

    // 6. title
    var title = el.getAttribute('title');
    if (title) return title.trim();

    // 7. Text content (for non-container elements)
    var textContent = (el.textContent || '').trim();
    if (textContent.length > 0 && textContent.length <= 100) return textContent;
    if (textContent.length > 100) return textContent.slice(0, 100);

    return '';
  }

  function getHeadingLevel(el) {
    var tag = el.tagName.toLowerCase();
    var m = tag.match(/^h([1-6])$/);
    if (m) return parseInt(m[1], 10);
    var ariaLevel = el.getAttribute('aria-level');
    if (ariaLevel) return parseInt(ariaLevel, 10);
    return undefined;
  }

  function isVisible(el) {
    if (el.offsetParent === null && el.tagName.toLowerCase() !== 'body' &&
        window.getComputedStyle(el).position !== 'fixed' &&
        window.getComputedStyle(el).display === 'none') return false;
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    var style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.opacity === '0') return false;
    return true;
  }

  var elements = [];
  var refCount = 0;

  // Flatten promoted children (recursively — nested non-semantic wrappers)
  function flatten(items) {
    var out = [];
    for (var j = 0; j < items.length; j++) {
      if (items[j].__promote) {
        var inner = flatten(items[j].__promote);
        for (var k = 0; k < inner.length; k++) out.push(inner[k]);
      } else {
        out.push(items[j]);
      }
    }
    return out;
  }

  function walk(node) {
    if (node.nodeType !== 1) return null;
    if (!isVisible(node)) {
      // Zero-size containers (e.g. React portal wrappers) may have visible
      // overflow children.  Still walk their subtree and promote any results.
      var _r = node.getBoundingClientRect();
      if (_r.width === 0 && _r.height === 0) {
        var _s = window.getComputedStyle(node);
        if (_s.display !== 'none') {
          var _children = [];
          for (var _i = 0; _i < node.children.length; _i++) {
            var _c = walk(node.children[_i]);
            if (_c) _children.push(_c);
          }
          if (_children.length > 0) return { __promote: _children };
        }
      }
      return null;
    }

    var role = getRole(node);
    var name = role ? getAccessibleName(node) : '';
    var level = getHeadingLevel(node);
    var isLandmark = role && LANDMARK_ROLES[role];

    // Walk children first
    var childNodes = [];
    var children = node.children;
    for (var i = 0; i < children.length; i++) {
      var childResult = walk(children[i]);
      if (childResult) childNodes.push(childResult);
    }

    // Skip nodes with no role
    if (!role) {
      // Promote children of non-semantic wrappers
      if (childNodes.length > 0) return { __promote: childNodes };
      return null;
    }

    // Assign ref if the node has a role + name, or is a landmark
    var ref = null;
    if ((name || isLandmark) && refCount < maxElements) {
      refCount++;
      ref = 'e' + refCount;

      var tag = node.tagName.toLowerCase();
      var rect = node.getBoundingClientRect();
      var attrs = {};
      var id = node.getAttribute('id');
      var elName = node.getAttribute('name');
      var type = node.getAttribute('type');
      var href = node.getAttribute('href');
      var placeholder = node.getAttribute('placeholder');
      if (id) attrs['id'] = id;
      if (elName) attrs['name'] = elName;
      if (type) attrs['type'] = type;
      if (href) attrs['href'] = href;
      if (placeholder) attrs['placeholder'] = placeholder;

      var isClickable = ['link','button'].indexOf(role) !== -1 ||
                        ['a','button','input'].indexOf(tag) !== -1 ||
                        node.hasAttribute('onclick') ||
                        node.getAttribute('role') === 'button';

      elements.push({
        ref: ref,
        tagName: tag,
        role: role,
        text: name.slice(0, 100),
        level: level,
        ariaLabel: node.getAttribute('aria-label') || null,
        isClickable: isClickable,
        isVisible: true,
        attributes: attrs,
        boundingBox: {
          x: rect.x + window.scrollX,
          y: rect.y + window.scrollY,
          width: rect.width,
          height: rect.height
        }
      });
    }

    var treeChildren = flatten(childNodes);

    var treeNode = {
      role: role,
      name: name.slice(0, 100),
      children: treeChildren
    };
    if (ref) treeNode.ref = ref;
    if (level !== undefined) treeNode.level = level;

    return treeNode;
  }

  var root = scopeSelector ? document.querySelector(scopeSelector) : document.body;
  if (!root) root = document.body;

  var result = walk(root);
  var tree;

  if (!result) {
    tree = { role: 'document', name: '', children: [] };
  } else if (result.__promote) {
    tree = { role: 'document', name: '', children: flatten(result.__promote) };
  } else {
    tree = result;
  }

  return { elements: elements, tree: tree };
`;

export interface DiscoveryResult {
  elements: Map<string, ElementInfo>;
  tree: AccessibilityNode;
}

/**
 * Discover elements by walking the DOM accessibility tree.
 * Returns both a flat element map (for ref resolution) and a hierarchical tree.
 */
export async function discoverElements(
  driver: WebDriver,
  scopeSelector?: string
): Promise<DiscoveryResult> {
  const raw = await driver.executeScript(
    ACCESSIBILITY_TREE_SCRIPT,
    scopeSelector || null,
    MAX_ELEMENTS
  ) as {
    elements: Array<{
      ref: string;
      tagName: string;
      role: string;
      text: string;
      level?: number;
      ariaLabel: string | null;
      isClickable: boolean;
      isVisible: boolean;
      attributes: Record<string, string>;
      boundingBox: { x: number; y: number; width: number; height: number };
    }>;
    tree: AccessibilityNode;
  };

  const elements = new Map<string, ElementInfo>();
  for (const el of raw.elements) {
    elements.set(el.ref, {
      ref: el.ref,
      tagName: el.tagName,
      role: el.role,
      text: el.text,
      level: el.level,
      ariaLabel: el.ariaLabel || undefined,
      isClickable: el.isClickable,
      isVisible: el.isVisible,
      attributes: el.attributes,
      boundingBox: el.boundingBox,
    });
  }

  return { elements, tree: raw.tree };
}

/**
 * Format an accessibility tree as indented text for snapshot output.
 */
export function formatAccessibilityTree(tree: AccessibilityNode, maxLength?: number): string {
  const lines: string[] = [];

  function walk(node: AccessibilityNode, depth: number): void {
    const indent = '  '.repeat(depth);
    const prefix = '- ';

    let line = `${indent}${prefix}${node.role}`;
    if (node.name) line += ` "${node.name}"`;
    if (node.level !== undefined) line += ` [level=${node.level}]`;
    if (node.ref) line += ` [ref=${node.ref}]`;

    lines.push(line);

    for (const child of node.children) {
      walk(child, depth + 1);
    }
  }

  if (tree.role !== 'document') {
    // Non-document root: include the root node itself
    walk(tree, 0);
  } else {
    // Document root: just walk children at top level
    for (const child of tree.children) {
      walk(child, 0);
    }
  }

  let text = lines.join('\n');

  if (maxLength && text.length > maxLength) {
    text = text.slice(0, maxLength) + '\n... (truncated)';
  }

  return text;
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
  const role = await el.getAttribute('role');

  const rect = await el.getRect();
  const isClickable = ['a', 'button', 'input'].includes(tagName.toLowerCase()) ||
                      (await el.getAttribute('onclick')) !== null ||
                      role === 'button';

  const attributes: Record<string, string> = {};
  if (id) attributes['id'] = id;
  if (name) attributes['name'] = name;
  if (type) attributes['type'] = type;
  if (href) attributes['href'] = href;
  if (placeholder) attributes['placeholder'] = placeholder;

  return {
    ref,
    tagName,
    role: role || tagName.toLowerCase(),
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
