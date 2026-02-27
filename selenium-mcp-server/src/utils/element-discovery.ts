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
  var verboseAttrs = arguments[2];

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

  function cssEscape(str) {
    try {
      return CSS.escape(str);
    } catch (_) {
      // Manual fallback for environments without CSS.escape
      return str.replace(/([^\w-])/g, '\\\\$1');
    }
  }

  // Essential attrs always kept in lean mode
  var ESSENTIAL_ATTRS = { 'id':1, 'name':1, 'type':1, 'role':1, 'data-testid':1, 'data-test':1, 'data-cy':1, 'data-qa':1 };

  // Extract the attribute name that a CSS selector is based on (e.g. "input[name='email']" → "name")
  function selectorWinningAttr(cssSel) {
    if (!cssSel) return null;
    // Match the first [attr=...] or [attr^=...] in the selector
    var m = cssSel.match(/\\[([a-zA-Z][a-zA-Z0-9_-]*)(?:[\\^\\$\\*]?=)/);
    return m ? m[1] : null;
  }

  function filterAttrs(attrs, cssSel) {
    if (verboseAttrs) return attrs;
    var winner = selectorWinningAttr(cssSel);
    var filtered = {};
    var keys = Object.keys(attrs);
    for (var fi = 0; fi < keys.length; fi++) {
      var k = keys[fi];
      if (ESSENTIAL_ATTRS[k] || (winner && k === winner)) {
        filtered[k] = attrs[k];
      }
    }
    return filtered;
  }

  // Try exact match then starts-with fallback for any attribute selector.
  // Returns the unique CSS selector string or null.
  function tryAttr(prefix, attr, value) {
    if (!value) return null;
    var escaped = value.replace(/"/g, '\\\\"');
    // 1. Exact match
    var exact = prefix + '[' + attr + '="' + escaped + '"]';
    try { if (document.querySelectorAll(exact).length === 1) return exact; } catch (_) {}
    // 2. Starts-with fallback for long values (> 40 chars)
    if (value.length > 40) {
      var truncated = value.slice(0, 40).replace(/"/g, '\\\\"');
      var startsWith = prefix + '[' + attr + '^="' + truncated + '"]';
      try { if (document.querySelectorAll(startsWith).length === 1) return startsWith; } catch (_) {}
    }
    return null;
  }

  function computeSelector(el) {
    var tag = el.tagName.toLowerCase();
    var result = { css: null, xpath: null };
    var s;

    // Attributes to skip during dynamic discovery (handled specially or too volatile)
    var SKIP_ATTRS = {
      'id': 1, 'class': 1, 'style': 1, 'slot': 1,
      // Event handlers
      'onclick': 1, 'onchange': 1, 'onsubmit': 1, 'onload': 1, 'onerror': 1,
      'onfocus': 1, 'onblur': 1, 'onmouseover': 1, 'onmouseout': 1, 'onkeydown': 1,
      'onkeyup': 1, 'onkeypress': 1, 'oninput': 1, 'onscroll': 1, 'onresize': 1,
      // React/framework internals
      'data-reactid': 1, 'data-reactroot': 1, 'data-react-checksum': 1,
      // Too volatile / layout-only
      'tabindex': 1, 'draggable': 1, 'hidden': 1, 'dir': 1, 'lang': 1,
      'width': 1, 'height': 1, 'colspan': 1, 'rowspan': 1
    };

    // Priority order for well-known attributes (tried first, in this order)
    var PRIORITY_ATTRS = [
      'data-testid', 'data-test', 'data-cy', 'data-qa',
      'name', 'placeholder', 'alt', 'aria-label', 'title',
      'datetime', 'value', 'for', 'src', 'action', 'href',
      'formaction', 'formcontrolname', 'ng-model', 'v-model', 'data-bind',
      'aria-controls', 'aria-describedby', 'aria-labelledby',
      'type', 'role', 'method', 'target', 'rel', 'accept',
      'scope', 'headers', 'contenteditable', 'autocomplete',
      'pattern', 'min', 'max', 'step'
    ];

    // --- Phase 1: #id (most stable) ---
    var id = el.getAttribute('id');
    if (id && id.length > 0) {
      try {
        if (document.querySelectorAll('#' + cssEscape(id)).length === 1) {
          result.css = '#' + cssEscape(id);
          return result;
        }
      } catch (_) { /* invalid selector, skip */ }
    }

    // --- Phase 2: Priority attributes (well-known, in preferred order) ---
    var tried = {};
    for (var pi = 0; pi < PRIORITY_ATTRS.length; pi++) {
      var pAttr = PRIORITY_ATTRS[pi];
      tried[pAttr] = 1;
      s = tryAttr(tag, pAttr, el.getAttribute(pAttr));
      if (s) { result.css = s; return result; }
    }

    // --- Phase 3: Dynamic discovery — try ALL remaining attributes ---
    var attrs = el.attributes;
    if (attrs) {
      for (var di = 0; di < attrs.length; di++) {
        var attrName = attrs[di].name;
        if (SKIP_ATTRS[attrName] || tried[attrName]) continue;
        // Skip attributes starting with 'on' (event handlers we missed)
        if (attrName.indexOf('on') === 0 && attrName.length > 2) continue;
        s = tryAttr(tag, attrName, attrs[di].value);
        if (s) { result.css = s; return result; }
      }
    }

    // --- Phase 4: Role-based selectors (dialogs/modals/widgets) ---
    var elRole = el.getAttribute('role');
    if (elRole && ['dialog', 'alertdialog', 'tabpanel', 'menu', 'listbox', 'grid', 'tree', 'tooltip'].indexOf(elRole) !== -1) {
      var roleAriaLabel = el.getAttribute('aria-label');
      if (roleAriaLabel) {
        s = tryAttr('[role="' + elRole + '"]', 'aria-label', roleAriaLabel);
        if (s) { result.css = s; return result; }
      }
      var roleSelector = '[role="' + elRole + '"]';
      try {
        if (document.querySelectorAll(roleSelector).length === 1) {
          result.css = roleSelector;
          return result;
        }
      } catch (_) { /* skip */ }
    }

    // --- Phase 5: Stateful selectors (dialog[open], aria-expanded) ---
    if ((tag === 'dialog' || tag === 'details') && el.hasAttribute('open')) {
      var openSelector = tag + '[open]';
      try {
        if (document.querySelectorAll(openSelector).length === 1) {
          result.css = openSelector;
          return result;
        }
      } catch (_) { /* skip */ }
    }
    if (el.getAttribute('aria-expanded') !== null) {
      var expLabel = el.getAttribute('aria-label');
      if (expLabel) {
        s = tryAttr(tag + '[aria-expanded]', 'aria-label', expLabel);
        if (s) { result.css = s; return result; }
      }
    }

    // --- Phase 6: Unique class ---
    if (el.classList && el.classList.length > 0) {
      for (var ci = 0; ci < el.classList.length; ci++) {
        var cls = el.classList[ci];
        if (cls.length < 3 || /^[a-z]{1,2}\d|^css-|^_|^\d/.test(cls)) continue;
        var clsSelector = tag + '.' + cssEscape(cls);
        try {
          if (document.querySelectorAll(clsSelector).length === 1) {
            result.css = clsSelector;
            return result;
          }
        } catch (_) { /* skip */ }
      }
    }

    // --- Phase 7: Table cell selectors (th/td/caption with row/col context) ---
    if (['th', 'td', 'caption'].indexOf(tag) !== -1) {
      if (tag === 'caption') {
        var tableParent = el.closest('table');
        if (tableParent) {
          var tableId = tableParent.getAttribute('id');
          if (tableId) {
            var capSelector = '#' + cssEscape(tableId) + ' > caption';
            try { if (document.querySelectorAll(capSelector).length === 1) { result.css = capSelector; return result; } } catch (_) {}
          }
        }
      }
      if (tag === 'td' || tag === 'th') {
        var row = el.parentElement;
        if (row && row.tagName.toLowerCase() === 'tr') {
          var cellIndex = 0;
          var siblings = row.children;
          for (var si = 0; si < siblings.length; si++) {
            if (siblings[si] === el) { cellIndex = si + 1; break; }
          }
          var table = el.closest('table');
          if (table) {
            var tblId = table.getAttribute('id');
            if (tblId) {
              var section = row.parentElement;
              if (section) {
                var rows = section.children;
                var rowIndex = 0;
                for (var ri = 0; ri < rows.length; ri++) {
                  if (rows[ri] === row) { rowIndex = ri + 1; break; }
                }
                var secTag = section.tagName.toLowerCase();
                var tblSelector = '#' + cssEscape(tblId) + ' > ' + secTag + ' > tr:nth-child(' + rowIndex + ') > ' + tag + ':nth-child(' + cellIndex + ')';
                try { if (document.querySelectorAll(tblSelector).length === 1) { result.css = tblSelector; return result; } } catch (_) {}
              }
            }
          }
        }
      }
    }

    // --- Phase 8: Compound attribute fallback (combine two non-unique attrs) ---
    if (attrs) {
      // Collect usable attribute pairs from the element
      var usable = [];
      for (var ui = 0; ui < attrs.length; ui++) {
        var uName = attrs[ui].name;
        var uVal = attrs[ui].value;
        if (SKIP_ATTRS[uName] || !uVal || uName === 'id') continue;
        if (uName.indexOf('on') === 0 && uName.length > 2) continue;
        if (uVal.length > 60) continue; // skip very long values for compound
        usable.push({ n: uName, v: uVal });
      }
      // Try pairs (max 10 combinations to keep fast)
      var maxPairs = Math.min(usable.length, 5);
      for (var p1 = 0; p1 < maxPairs; p1++) {
        for (var p2 = p1 + 1; p2 < maxPairs; p2++) {
          var compound = tag + '[' + usable[p1].n + '="' + usable[p1].v.replace(/"/g, '\\\\"') + '"][' + usable[p2].n + '="' + usable[p2].v.replace(/"/g, '\\\\"') + '"]';
          try { if (document.querySelectorAll(compound).length === 1) { result.css = compound; return result; } } catch (_) {}
        }
      }
      // Also try class + attribute compound
      if (el.classList && el.classList.length > 0) {
        for (var cci = 0; cci < el.classList.length && cci < 3; cci++) {
          var ccls = el.classList[cci];
          if (ccls.length < 3) continue;
          for (var cai = 0; cai < maxPairs; cai++) {
            var clsCompound = tag + '.' + cssEscape(ccls) + '[' + usable[cai].n + '="' + usable[cai].v.replace(/"/g, '\\\\"') + '"]';
            try { if (document.querySelectorAll(clsCompound).length === 1) { result.css = clsCompound; return result; } } catch (_) {}
          }
        }
      }
    }

    // --- Phase 9: Indexed fallback — tag:nth-of-type(n) as last CSS resort ---
    //     Marked with /*idx*/ so AI/healer knows this is positional and fragile
    var parent = el.parentElement;
    if (parent) {
      var nthIndex = 0;
      var sibs = parent.children;
      for (var ni = 0; ni < sibs.length; ni++) {
        if (sibs[ni].tagName === el.tagName) nthIndex++;
        if (sibs[ni] === el) break;
      }
      var chain = tag + ':nth-of-type(' + nthIndex + ')';
      var ancestor = parent;
      for (var depth = 0; depth < 2 && ancestor; depth++) {
        var aTag = ancestor.tagName.toLowerCase();
        if (aTag === 'body' || aTag === 'html') break;
        var aId = ancestor.getAttribute('id');
        if (aId) {
          chain = '#' + cssEscape(aId) + ' > ' + chain;
          break;
        }
        var aClass = '';
        if (ancestor.classList && ancestor.classList.length > 0) {
          for (var aci = 0; aci < ancestor.classList.length; aci++) {
            var ac = ancestor.classList[aci];
            if (ac.length >= 3 && !/^[a-z]{1,2}\d|^css-|^_|^\d/.test(ac)) { aClass = '.' + cssEscape(ac); break; }
          }
        }
        chain = aTag + aClass + ' > ' + chain;
        ancestor = ancestor.parentElement;
      }
      var idxSelector = '/*idx*/ ' + chain;
      try {
        if (document.querySelectorAll(chain).length === 1) {
          result.css = idxSelector;
          return result;
        }
      } catch (_) { /* skip */ }
    }

    // --- Phase 10: XPath text fallback ---
    var textContent = (el.textContent || '').trim();
    if (textContent.length > 0 && textContent.length <= 80) {
      var safeText = textContent.replace(/'/g, "\\'").slice(0, 50);
      result.xpath = '//' + tag + "[contains(text(),'" + safeText + "')]";
    }

    return result;
  }

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
      // Dynamically collect all attributes (skip volatile/layout-only ones)
      var nodeAttrs = node.attributes;
      for (var nai = 0; nai < nodeAttrs.length; nai++) {
        var aName = nodeAttrs[nai].name;
        var aVal = nodeAttrs[nai].value;
        // Skip style, class (stored separately), event handlers, layout attrs
        if (aName === 'style' || aName === 'class' || aName === 'slot') continue;
        if (aName.indexOf('on') === 0 && aName.length > 2) continue;
        if (aName === 'data-reactid' || aName === 'data-reactroot' || aName === 'data-react-checksum') continue;
        if (!aVal || aVal.length > 200) continue; // skip empty or excessively long values
        attrs[aName] = aVal;
      }

      var selectorResult = computeSelector(node);
      var storedAttrs = filterAttrs(attrs, selectorResult.css);

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
        attributes: storedAttrs,
        css: selectorResult.css,
        xpath: selectorResult.xpath,
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
    if (ref && elements.length > 0) {
      var lastEl = elements[elements.length - 1];
      if (lastEl.ref === ref && lastEl.css) treeNode.css = lastEl.css;
    }

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
  scopeSelector?: string,
  verboseAttributes: boolean = false,
): Promise<DiscoveryResult> {
  const raw = await driver.executeScript(
    ACCESSIBILITY_TREE_SCRIPT,
    scopeSelector || null,
    MAX_ELEMENTS,
    verboseAttributes,
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
      css: string | null;
      xpath: string | null;
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
      css: el.css || undefined,
      xpath: el.xpath || undefined,
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
    if (node.ref && node.css) line += ` [ref=${node.ref}, css=${node.css}]`;
    else if (node.ref) line += ` [ref=${node.ref}]`;

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

/**
 * Browser-side script that computes a CSS/XPath selector for a single element.
 * Mirrors the computeSelector() logic from ACCESSIBILITY_TREE_SCRIPT.
 */
const COMPUTE_SELECTOR_SCRIPT = `
  var el = arguments[0];
  var tag = el.tagName.toLowerCase();

  function cssEscape(str) {
    try { return CSS.escape(str); } catch (_) { return str.replace(/([^\\w-])/g, '\\\\$1'); }
  }

  function tryAttr(prefix, attr, value) {
    if (!value) return null;
    var escaped = value.replace(/"/g, '\\\\"');
    var exact = prefix + '[' + attr + '="' + escaped + '"]';
    try { if (document.querySelectorAll(exact).length === 1) return exact; } catch (_) {}
    if (value.length > 40) {
      var truncated = value.slice(0, 40).replace(/"/g, '\\\\"');
      var startsWith = prefix + '[' + attr + '^="' + truncated + '"]';
      try { if (document.querySelectorAll(startsWith).length === 1) return startsWith; } catch (_) {}
    }
    return null;
  }

  var s;

  var SKIP_ATTRS = {
    'id': 1, 'class': 1, 'style': 1, 'slot': 1,
    'onclick': 1, 'onchange': 1, 'onsubmit': 1, 'onload': 1, 'onerror': 1,
    'onfocus': 1, 'onblur': 1, 'onmouseover': 1, 'onmouseout': 1, 'onkeydown': 1,
    'onkeyup': 1, 'onkeypress': 1, 'oninput': 1, 'onscroll': 1, 'onresize': 1,
    'data-reactid': 1, 'data-reactroot': 1, 'data-react-checksum': 1,
    'tabindex': 1, 'draggable': 1, 'hidden': 1, 'dir': 1, 'lang': 1,
    'width': 1, 'height': 1, 'colspan': 1, 'rowspan': 1
  };

  var PRIORITY_ATTRS = [
    'data-testid', 'data-test', 'data-cy', 'data-qa',
    'name', 'placeholder', 'alt', 'aria-label', 'title',
    'datetime', 'value', 'for', 'src', 'action', 'href',
    'formaction', 'formcontrolname', 'ng-model', 'v-model', 'data-bind',
    'aria-controls', 'aria-describedby', 'aria-labelledby',
    'type', 'role', 'method', 'target', 'rel', 'accept',
    'scope', 'headers', 'contenteditable', 'autocomplete',
    'pattern', 'min', 'max', 'step'
  ];

  // Phase 1: #id
  var id = el.getAttribute('id');
  if (id && id.length > 0) {
    try {
      if (document.querySelectorAll('#' + cssEscape(id)).length === 1) {
        return { css: '#' + cssEscape(id), xpath: null };
      }
    } catch (_) {}
  }

  // Phase 2: Priority attributes
  var tried = {};
  for (var pi = 0; pi < PRIORITY_ATTRS.length; pi++) {
    var pAttr = PRIORITY_ATTRS[pi];
    tried[pAttr] = 1;
    s = tryAttr(tag, pAttr, el.getAttribute(pAttr));
    if (s) return { css: s, xpath: null };
  }

  // Phase 3: Dynamic discovery — ALL remaining attributes
  var attrs = el.attributes;
  if (attrs) {
    for (var di = 0; di < attrs.length; di++) {
      var attrName = attrs[di].name;
      if (SKIP_ATTRS[attrName] || tried[attrName]) continue;
      if (attrName.indexOf('on') === 0 && attrName.length > 2) continue;
      s = tryAttr(tag, attrName, attrs[di].value);
      if (s) return { css: s, xpath: null };
    }
  }

  // Phase 4: Role-based selectors
  var elRole = el.getAttribute('role');
  if (elRole && ['dialog', 'alertdialog', 'tabpanel', 'menu', 'listbox', 'grid', 'tree', 'tooltip'].indexOf(elRole) !== -1) {
    var roleAriaLabel = el.getAttribute('aria-label');
    if (roleAriaLabel) {
      s = tryAttr('[role="' + elRole + '"]', 'aria-label', roleAriaLabel);
      if (s) return { css: s, xpath: null };
    }
    var rs = '[role="' + elRole + '"]';
    try { if (document.querySelectorAll(rs).length === 1) return { css: rs, xpath: null }; } catch (_) {}
  }

  // Phase 5: Stateful selectors
  if ((tag === 'dialog' || tag === 'details') && el.hasAttribute('open')) {
    var os = tag + '[open]';
    try { if (document.querySelectorAll(os).length === 1) return { css: os, xpath: null }; } catch (_) {}
  }
  if (el.getAttribute('aria-expanded') !== null) {
    var expLabel = el.getAttribute('aria-label');
    if (expLabel) {
      s = tryAttr(tag + '[aria-expanded]', 'aria-label', expLabel);
      if (s) return { css: s, xpath: null };
    }
  }

  // Phase 6: Unique class
  if (el.classList && el.classList.length > 0) {
    for (var ci = 0; ci < el.classList.length; ci++) {
      var cls = el.classList[ci];
      if (cls.length < 3 || /^[a-z]{1,2}\\d|^css-|^_|^\\d/.test(cls)) continue;
      var cs = tag + '.' + cssEscape(cls);
      try { if (document.querySelectorAll(cs).length === 1) return { css: cs, xpath: null }; } catch (_) {}
    }
  }

  // Phase 7: Table cell selectors
  if (['th', 'td', 'caption'].indexOf(tag) !== -1) {
    if (tag === 'caption') {
      var tableParent = el.closest('table');
      if (tableParent) {
        var tableId = tableParent.getAttribute('id');
        if (tableId) {
          var capSel = '#' + cssEscape(tableId) + ' > caption';
          try { if (document.querySelectorAll(capSel).length === 1) return { css: capSel, xpath: null }; } catch (_) {}
        }
      }
    }
    if (tag === 'td' || tag === 'th') {
      var row = el.parentElement;
      if (row && row.tagName.toLowerCase() === 'tr') {
        var cellIndex = 0;
        var siblings = row.children;
        for (var si = 0; si < siblings.length; si++) {
          if (siblings[si] === el) { cellIndex = si + 1; break; }
        }
        var table = el.closest('table');
        if (table) {
          var tblId = table.getAttribute('id');
          if (tblId) {
            var section = row.parentElement;
            if (section) {
              var rows = section.children;
              var rowIndex = 0;
              for (var ri = 0; ri < rows.length; ri++) {
                if (rows[ri] === row) { rowIndex = ri + 1; break; }
              }
              var secTag = section.tagName.toLowerCase();
              var tblSel = '#' + cssEscape(tblId) + ' > ' + secTag + ' > tr:nth-child(' + rowIndex + ') > ' + tag + ':nth-child(' + cellIndex + ')';
              try { if (document.querySelectorAll(tblSel).length === 1) return { css: tblSel, xpath: null }; } catch (_) {}
            }
          }
        }
      }
    }
  }

  // Phase 8: Compound attribute fallback
  if (attrs) {
    var usable = [];
    for (var ui = 0; ui < attrs.length; ui++) {
      var uName = attrs[ui].name;
      var uVal = attrs[ui].value;
      if (SKIP_ATTRS[uName] || !uVal || uName === 'id') continue;
      if (uName.indexOf('on') === 0 && uName.length > 2) continue;
      if (uVal.length > 60) continue;
      usable.push({ n: uName, v: uVal });
    }
    var maxPairs = Math.min(usable.length, 5);
    for (var p1 = 0; p1 < maxPairs; p1++) {
      for (var p2 = p1 + 1; p2 < maxPairs; p2++) {
        var compound = tag + '[' + usable[p1].n + '="' + usable[p1].v.replace(/"/g, '\\\\"') + '"][' + usable[p2].n + '="' + usable[p2].v.replace(/"/g, '\\\\"') + '"]';
        try { if (document.querySelectorAll(compound).length === 1) return { css: compound, xpath: null }; } catch (_) {}
      }
    }
    if (el.classList && el.classList.length > 0) {
      for (var cci = 0; cci < el.classList.length && cci < 3; cci++) {
        var ccls = el.classList[cci];
        if (ccls.length < 3) continue;
        for (var cai = 0; cai < maxPairs; cai++) {
          var clsCompound = tag + '.' + cssEscape(ccls) + '[' + usable[cai].n + '="' + usable[cai].v.replace(/"/g, '\\\\"') + '"]';
          try { if (document.querySelectorAll(clsCompound).length === 1) return { css: clsCompound, xpath: null }; } catch (_) {}
        }
      }
    }
  }

  // Phase 9: Indexed fallback
  var parent = el.parentElement;
  if (parent) {
    var nthIndex = 0;
    var sibs = parent.children;
    for (var ni = 0; ni < sibs.length; ni++) {
      if (sibs[ni].tagName === el.tagName) nthIndex++;
      if (sibs[ni] === el) break;
    }
    var chain = tag + ':nth-of-type(' + nthIndex + ')';
    var ancestor = parent;
    for (var depth = 0; depth < 2 && ancestor; depth++) {
      var aTag = ancestor.tagName.toLowerCase();
      if (aTag === 'body' || aTag === 'html') break;
      var aId = ancestor.getAttribute('id');
      if (aId) { chain = '#' + cssEscape(aId) + ' > ' + chain; break; }
      var aClass = '';
      if (ancestor.classList && ancestor.classList.length > 0) {
        for (var aci = 0; aci < ancestor.classList.length; aci++) {
          var ac = ancestor.classList[aci];
          if (ac.length >= 3 && !/^[a-z]{1,2}\\d|^css-|^_|^\\d/.test(ac)) { aClass = '.' + cssEscape(ac); break; }
        }
      }
      chain = aTag + aClass + ' > ' + chain;
      ancestor = ancestor.parentElement;
    }
    var idxSelector = '/*idx*/ ' + chain;
    try {
      if (document.querySelectorAll(chain).length === 1) return { css: idxSelector, xpath: null };
    } catch (_) {}
  }

  // Phase 10: XPath text fallback
  var text = (el.textContent || '').trim();
  if (text.length > 0 && text.length <= 80) {
    var safe = text.replace(/'/g, "\\\\'").slice(0, 50);
    return { css: null, xpath: '//' + tag + "[contains(text(),'" + safe + "')]" };
  }

  return { css: null, xpath: null };
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
  // Extract the winning attr from the CSS selector
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
