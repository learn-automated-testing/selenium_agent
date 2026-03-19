import { WebDriver, WebElement } from 'selenium-webdriver';
import { ElementInfo, AccessibilityNode, SnapshotMode } from '../types.js';

const MAX_ELEMENTS = 200;

/**
 * Shared browser-side JS containing helper functions and computeSelector().
 * Embedded in both ACCESSIBILITY_TREE_SCRIPT and COMPUTE_SELECTOR_SCRIPT
 * to eliminate duplication. Must be ES5-compatible (runs in browser).
 */
const SELECTOR_COMPUTATION_CODE = `
  function cssEscape(str) {
    try {
      return CSS.escape(str);
    } catch (_) {
      return str.replace(/([^\\w-])/g, '\\\\$1');
    }
  }

  function xpathStringLiteral(str) {
    if (str.indexOf("'") === -1) return "'" + str + "'";
    if (str.indexOf('"') === -1) return '"' + str + '"';
    return "concat('" + str.replace(/'/g, "',\\"'\\",'") + "')";
  }

  function xpathUnique(xpath) {
    try {
      var r = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      return r.snapshotLength === 1;
    } catch (_) { return false; }
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

  function isNonSemanticClass(cls) {
    if (cls.length < 3 || /^\\d/.test(cls)) return true;
    // CSS-in-JS: css-xxx, sc-xxx, _hash, jssN, makeStyles-
    if (/^(css|sc|jss|makeStyles|withStyles)-/.test(cls)) return true;
    if (/^_[a-zA-Z0-9]/.test(cls)) return true;
    if (/^[a-z]{1,2}\\d/.test(cls)) return true;
    if (/^[a-f0-9]{6,}$/i.test(cls)) return true;
    // Utility patterns: mt-4, p-2, w-12, -mx-2
    if (/^-?[a-z]{1,4}-\\d/.test(cls)) return true;
    // Display/position keywords used as classes
    if (/^(flex|grid|block|inline|hidden|relative|absolute|fixed|sticky|static|contents|table|flow-root)$/.test(cls)) return true;
    // Category utilities
    if (/^(overflow|float|clear|object|box|isolation|z|order|col|row|justify|items|self|place|gap|space|divide|sr)-/.test(cls)) return true;
    // Responsive/state prefixes: sm:, md:, lg:, hover:, focus:, dark:
    if (/^[a-z0-9]+:/.test(cls)) return true;
    return false;
  }

  function computeSelector(el) {
    var tag = el.tagName.toLowerCase();
    var result = { css: null, xpath: null };
    var s, xp;

    // Attributes to skip during dynamic discovery
    var SKIP_ATTRS = {
      'id': 1, 'class': 1, 'style': 1, 'slot': 1,
      'onclick': 1, 'onchange': 1, 'onsubmit': 1, 'onload': 1, 'onerror': 1,
      'onfocus': 1, 'onblur': 1, 'onmouseover': 1, 'onmouseout': 1, 'onkeydown': 1,
      'onkeyup': 1, 'onkeypress': 1, 'oninput': 1, 'onscroll': 1, 'onresize': 1,
      'data-reactid': 1, 'data-reactroot': 1, 'data-react-checksum': 1,
      'tabindex': 1, 'draggable': 1, 'hidden': 1, 'dir': 1, 'lang': 1,
      'width': 1, 'height': 1, 'colspan': 1, 'rowspan': 1
    };

    // Tags where text-based selectors make sense
    var TEXT_TAGS = {
      'a':1, 'button':1, 'h1':1, 'h2':1, 'h3':1, 'h4':1, 'h5':1, 'h6':1,
      'label':1, 'summary':1, 'option':1, 'li':1, 'th':1, 'td':1, 'span':1,
      'p':1, 'legend':1, 'caption':1, 'figcaption':1, 'dt':1, 'dd':1
    };

    // Landmark tags for scoping
    var LANDMARK_TAGS = { 'nav':1, 'main':1, 'header':1, 'footer':1, 'aside':1, 'form':1 };

    // Implicit role map for Phase 3 (byRole+name)
    var TAG_ROLES = {
      'a':'link', 'button':'button', 'select':'combobox', 'textarea':'textbox',
      'h1':'heading', 'h2':'heading', 'h3':'heading', 'h4':'heading', 'h5':'heading', 'h6':'heading',
      'img':'img', 'nav':'navigation', 'main':'main', 'aside':'complementary',
      'dialog':'dialog', 'form':'form', 'table':'table', 'ul':'list', 'ol':'list',
      'li':'listitem', 'summary':'button', 'progress':'progressbar', 'meter':'meter'
    };

    // Get visible text content for selector use (trimmed, ≤ maxLen chars)
    function getVisibleText(e, maxLen) {
      var t = (e.textContent || '').trim();
      if (t.length === 0 || t.length > (maxLen || 60)) return null;
      return t;
    }

    // --- Phase 1: byId — unique #id ---
    var id = el.getAttribute('id');
    if (id && id.length > 0) {
      try {
        if (document.querySelectorAll('#' + cssEscape(id)).length === 1) {
          result.css = '#' + cssEscape(id);
          result.xpath = '//*[@id=' + xpathStringLiteral(id) + ']';
          return result;
        }
      } catch (_) {}
    }

    // --- Phase 2: byTestId — data-testid, data-test, data-cy, data-qa ---
    var TEST_ID_ATTRS = ['data-testid', 'data-test', 'data-cy', 'data-qa'];
    for (var ti = 0; ti < TEST_ID_ATTRS.length; ti++) {
      var tAttr = TEST_ID_ATTRS[ti];
      var tVal = el.getAttribute(tAttr);
      if (tVal) {
        s = tryAttr(tag, tAttr, tVal);
        if (s) {
          result.css = s;
          xp = '//' + tag + '[@' + tAttr + '=' + xpathStringLiteral(tVal) + ']';
          if (xpathUnique(xp)) result.xpath = xp;
          return result;
        }
        // Also try without tag prefix
        s = tryAttr('', tAttr, tVal);
        if (s) {
          result.css = s;
          xp = '//*[@' + tAttr + '=' + xpathStringLiteral(tVal) + ']';
          if (xpathUnique(xp)) result.xpath = xp;
          return result;
        }
      }
    }

    // --- Phase 3: byRole+name — tag implies role + accessible name ---
    var implicitRole = TAG_ROLES[tag];
    if (tag === 'a' && !el.hasAttribute('href')) implicitRole = null;
    if (tag === 'input') {
      var inputType = (el.getAttribute('type') || 'text').toLowerCase();
      var inputRoles = {
        'text':'textbox','search':'searchbox','email':'textbox','url':'textbox',
        'tel':'textbox','password':'textbox','number':'spinbutton',
        'checkbox':'checkbox','radio':'radio','range':'slider',
        'submit':'button','reset':'button','image':'button'
      };
      implicitRole = inputRoles[inputType] || 'textbox';
    }
    if (implicitRole) {
      var ariaLabel = el.getAttribute('aria-label');
      var textContent = getVisibleText(el, 60);

      // Try aria-label first (works in both CSS and XPath)
      if (ariaLabel) {
        s = tryAttr(tag, 'aria-label', ariaLabel);
        if (s) {
          result.css = s;
          xp = '//' + tag + '[@aria-label=' + xpathStringLiteral(ariaLabel) + ']';
          if (xpathUnique(xp)) result.xpath = xp;
          return result;
        }
      }

      // Try text content (XPath only — CSS can't match text)
      if (textContent) {
        xp = '//' + tag + '[normalize-space()=' + xpathStringLiteral(textContent) + ']';
        if (xpathUnique(xp)) {
          result.xpath = xp;
          return result;
        }
      }
    }

    // --- Phase 4: byLabel — form elements with label association ---
    if (['input','select','textarea'].indexOf(tag) !== -1) {
      var lAriaLabel = el.getAttribute('aria-label');
      if (lAriaLabel) {
        s = tryAttr(tag, 'aria-label', lAriaLabel);
        if (s) {
          result.css = s;
          xp = '//' + tag + '[@aria-label=' + xpathStringLiteral(lAriaLabel) + ']';
          if (xpathUnique(xp)) result.xpath = xp;
          return result;
        }
      }
      // label[for] association
      var elId = el.getAttribute('id');
      if (elId) {
        var labelEl = document.querySelector('label[for="' + elId.replace(/"/g, '\\\\"') + '"]');
        if (labelEl) {
          var labelText = (labelEl.textContent || '').trim();
          if (labelText && labelText.length <= 60) {
            xp = '//label[normalize-space()=' + xpathStringLiteral(labelText) + ']//' + tag;
            if (!xpathUnique(xp)) {
              xp = '//label[normalize-space()=' + xpathStringLiteral(labelText) + ']/following::' + tag + '[1]';
            }
            if (xpathUnique(xp)) {
              result.xpath = xp;
              return result;
            }
          }
        }
      }
      // Wrapping label
      var wrappingLabel = el.closest('label');
      if (wrappingLabel) {
        var clone = wrappingLabel.cloneNode(true);
        var inputs = clone.querySelectorAll('input,select,textarea');
        for (var ii = 0; ii < inputs.length; ii++) inputs[ii].remove();
        var wLabelText = (clone.textContent || '').trim();
        if (wLabelText && wLabelText.length <= 60) {
          xp = '//label[contains(normalize-space(),' + xpathStringLiteral(wLabelText) + ')]//' + tag;
          if (xpathUnique(xp)) {
            result.xpath = xp;
            return result;
          }
        }
      }
    }

    // --- Phase 5: byPlaceholder ---
    var placeholder = el.getAttribute('placeholder');
    if (placeholder) {
      s = tryAttr(tag, 'placeholder', placeholder);
      if (s) {
        result.css = s;
        xp = '//' + tag + '[@placeholder=' + xpathStringLiteral(placeholder) + ']';
        if (xpathUnique(xp)) result.xpath = xp;
        return result;
      }
    }

    // --- Phase 6: byText — visible text content (exact match) ---
    if (TEXT_TAGS[tag]) {
      var exactText = getVisibleText(el, 60);
      if (exactText) {
        xp = '//' + tag + '[normalize-space()=' + xpathStringLiteral(exactText) + ']';
        if (xpathUnique(xp)) {
          result.xpath = xp;
          return result;
        }
      }
    }

    // --- Phase 7: byText+landmark — text scoped to nearest landmark ---
    if (TEXT_TAGS[tag]) {
      var landmarkText = getVisibleText(el, 60);
      if (landmarkText) {
        var ancestor = el.parentElement;
        for (var ld = 0; ld < 10 && ancestor; ld++) {
          var aTag = ancestor.tagName.toLowerCase();
          var aRole = ancestor.getAttribute('role');
          var isLandmark = LANDMARK_TAGS[aTag] || (aTag === 'section' && (ancestor.hasAttribute('aria-label') || ancestor.hasAttribute('aria-labelledby')));
          var isRoleLandmark = aRole && ['navigation','main','banner','contentinfo','complementary','search','form','region'].indexOf(aRole) !== -1;

          if (isLandmark || isRoleLandmark) {
            // Try landmark tag path
            if (isLandmark) {
              // If landmark has aria-label, use it for disambiguation
              var landmarkAriaLabel = ancestor.getAttribute('aria-label');
              if (landmarkAriaLabel) {
                xp = '//' + aTag + '[@aria-label=' + xpathStringLiteral(landmarkAriaLabel) + ']//' + tag + '[normalize-space()=' + xpathStringLiteral(landmarkText) + ']';
              } else {
                xp = '//' + aTag + '//' + tag + '[normalize-space()=' + xpathStringLiteral(landmarkText) + ']';
              }
              if (xpathUnique(xp)) {
                result.xpath = xp;
                return result;
              }
            }
            // Try role-based path
            if (isRoleLandmark) {
              xp = '//*[@role=' + xpathStringLiteral(aRole) + ']//' + tag + '[normalize-space()=' + xpathStringLiteral(landmarkText) + ']';
              if (xpathUnique(xp)) {
                result.xpath = xp;
                return result;
              }
            }
            break;
          }
          ancestor = ancestor.parentElement;
        }
      }
    }

    // --- Phase 8: byAttribute — remaining meaningful attributes ---
    var ATTR_PRIORITY = [
      'name', 'title', 'alt', 'href', 'src', 'action',
      'datetime', 'value', 'for',
      'formaction', 'formcontrolname', 'ng-model', 'v-model', 'data-bind',
      'aria-controls', 'aria-describedby', 'aria-labelledby',
      'type', 'method', 'target', 'rel', 'accept',
      'scope', 'headers', 'contenteditable', 'autocomplete',
      'pattern', 'min', 'max', 'step'
    ];
    var tried = {};
    for (var ai = 0; ai < ATTR_PRIORITY.length; ai++) {
      var aName = ATTR_PRIORITY[ai];
      tried[aName] = 1;
      var aVal = el.getAttribute(aName);
      if (aVal) {
        s = tryAttr(tag, aName, aVal);
        if (s) {
          result.css = s;
          // Build XPath companion
          if (aVal.length <= 60) {
            xp = '//' + tag + '[@' + aName + '=' + xpathStringLiteral(aVal) + ']';
            if (xpathUnique(xp)) result.xpath = xp;
          }
          return result;
        }
      }
    }
    // Dynamic discovery — try ALL remaining attributes
    var attrs = el.attributes;
    if (attrs) {
      for (var di = 0; di < attrs.length; di++) {
        var dName = attrs[di].name;
        if (SKIP_ATTRS[dName] || tried[dName]) continue;
        if (dName.indexOf('on') === 0 && dName.length > 2) continue;
        s = tryAttr(tag, dName, attrs[di].value);
        if (s) {
          result.css = s;
          var dVal = attrs[di].value;
          if (dVal.length <= 60) {
            xp = '//' + tag + '[@' + dName + '=' + xpathStringLiteral(dVal) + ']';
            if (xpathUnique(xp)) result.xpath = xp;
          }
          return result;
        }
      }
    }

    // --- Phase 9: byRole — unique role selector (dialog, menu, etc.) ---
    var elRole = el.getAttribute('role');
    if (elRole && ['dialog', 'alertdialog', 'tabpanel', 'menu', 'listbox', 'grid', 'tree', 'tooltip', 'tab', 'menuitem', 'treeitem'].indexOf(elRole) !== -1) {
      var roleAriaLabel = el.getAttribute('aria-label');
      if (roleAriaLabel) {
        s = tryAttr('[role="' + elRole + '"]', 'aria-label', roleAriaLabel);
        if (s) {
          result.css = s;
          xp = '//*[@role=' + xpathStringLiteral(elRole) + '][@aria-label=' + xpathStringLiteral(roleAriaLabel) + ']';
          if (xpathUnique(xp)) result.xpath = xp;
          return result;
        }
      }
      var roleSelector = '[role="' + elRole + '"]';
      try {
        if (document.querySelectorAll(roleSelector).length === 1) {
          result.css = roleSelector;
          xp = '//*[@role=' + xpathStringLiteral(elRole) + ']';
          if (xpathUnique(xp)) result.xpath = xp;
          return result;
        }
      } catch (_) {}
    }

    // --- Phase 10: byState — stateful selectors (dialog[open], aria-expanded) ---
    if ((tag === 'dialog' || tag === 'details') && el.hasAttribute('open')) {
      var openSelector = tag + '[open]';
      try {
        if (document.querySelectorAll(openSelector).length === 1) {
          result.css = openSelector;
          result.xpath = '//' + tag + '[@open]';
          return result;
        }
      } catch (_) {}
    }
    if (el.getAttribute('aria-expanded') !== null) {
      var expLabel = el.getAttribute('aria-label');
      if (expLabel) {
        s = tryAttr(tag + '[aria-expanded]', 'aria-label', expLabel);
        if (s) {
          result.css = s;
          xp = '//' + tag + '[@aria-expanded][@aria-label=' + xpathStringLiteral(expLabel) + ']';
          if (xpathUnique(xp)) result.xpath = xp;
          return result;
        }
      }
    }

    // --- Phase 11: byTableCell — table structure with ID context ---
    if (['th', 'td', 'caption'].indexOf(tag) !== -1) {
      if (tag === 'caption') {
        var tableParent = el.closest('table');
        if (tableParent) {
          var tableId = tableParent.getAttribute('id');
          if (tableId) {
            var capSelector = '#' + cssEscape(tableId) + ' > caption';
            try {
              if (document.querySelectorAll(capSelector).length === 1) {
                result.css = capSelector;
                result.xpath = '//*[@id=' + xpathStringLiteral(tableId) + ']/caption';
                return result;
              }
            } catch (_) {}
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
                try {
                  if (document.querySelectorAll(tblSelector).length === 1) {
                    result.css = tblSelector;
                    return result;
                  }
                } catch (_) {}
              }
            }
          }
        }
      }
    }

    // --- Phase 12: byCompound — combine two non-unique attrs ---
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
          try {
            if (document.querySelectorAll(compound).length === 1) {
              result.css = compound;
              xp = '//' + tag + '[@' + usable[p1].n + '=' + xpathStringLiteral(usable[p1].v) + '][@' + usable[p2].n + '=' + xpathStringLiteral(usable[p2].v) + ']';
              if (xpathUnique(xp)) result.xpath = xp;
              return result;
            }
          } catch (_) {}
        }
      }
      // class + attribute compound
      if (el.classList && el.classList.length > 0) {
        for (var cci = 0; cci < el.classList.length && cci < 3; cci++) {
          var ccls = el.classList[cci];
          if (isNonSemanticClass(ccls)) continue;
          for (var cai = 0; cai < maxPairs; cai++) {
            var clsCompound = tag + '.' + cssEscape(ccls) + '[' + usable[cai].n + '="' + usable[cai].v.replace(/"/g, '\\\\"') + '"]';
            try {
              if (document.querySelectorAll(clsCompound).length === 1) {
                result.css = clsCompound;
                return result;
              }
            } catch (_) {}
          }
        }
      }
    }

    // --- Phase 13: byClass — unique semantic class (with improved filter) ---
    if (el.classList && el.classList.length > 0) {
      for (var ci = 0; ci < el.classList.length; ci++) {
        var cls = el.classList[ci];
        if (isNonSemanticClass(cls)) continue;
        var clsSelector = tag + '.' + cssEscape(cls);
        try {
          if (document.querySelectorAll(clsSelector).length === 1) {
            result.css = clsSelector;
            xp = '//' + tag + '[contains(@class,' + xpathStringLiteral(cls) + ')]';
            if (xpathUnique(xp)) result.xpath = xp;
            return result;
          }
        } catch (_) {}
      }
    }

    // --- Phase 14: byIndex — positional fallback, marked /*idx*/ ---
    var parent = el.parentElement;
    if (parent) {
      var nthIndex = 0;
      var sibs = parent.children;
      for (var ni = 0; ni < sibs.length; ni++) {
        if (sibs[ni].tagName === el.tagName) nthIndex++;
        if (sibs[ni] === el) break;
      }
      var chain = tag + ':nth-of-type(' + nthIndex + ')';
      var anc = parent;
      for (var depth = 0; depth < 2 && anc; depth++) {
        var ancTag = anc.tagName.toLowerCase();
        if (ancTag === 'body' || ancTag === 'html') break;
        var ancId = anc.getAttribute('id');
        if (ancId) {
          chain = '#' + cssEscape(ancId) + ' > ' + chain;
          break;
        }
        var ancClass = '';
        if (anc.classList && anc.classList.length > 0) {
          for (var aci = 0; aci < anc.classList.length; aci++) {
            var ac = anc.classList[aci];
            if (!isNonSemanticClass(ac)) { ancClass = '.' + cssEscape(ac); break; }
          }
        }
        chain = ancTag + ancClass + ' > ' + chain;
        anc = anc.parentElement;
      }
      var idxSelector = '/*idx*/ ' + chain;
      try {
        if (document.querySelectorAll(chain).length === 1) {
          result.css = idxSelector;
          return result;
        }
      } catch (_) {}
    }

    // --- Phase 15: byTextLoose — contains text fallback (last resort) ---
    var looseText = (el.textContent || '').trim();
    if (looseText.length > 0 && looseText.length <= 80) {
      // Try exact match with normalize-space first
      xp = '//' + tag + '[normalize-space()=' + xpathStringLiteral(looseText) + ']';
      if (xpathUnique(xp)) {
        result.xpath = xp;
        return result;
      }
      // Try contains with truncated text
      var truncText = looseText.length > 40 ? looseText.slice(0, 40) : looseText;
      xp = '//' + tag + '[contains(normalize-space(),' + xpathStringLiteral(truncText) + ')]';
      if (xpathUnique(xp)) {
        result.xpath = xp;
        return result;
      }
    }

    return result;
  }
`;

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

  // Essential attrs always kept in lean mode
  var ESSENTIAL_ATTRS = { 'id':1, 'name':1, 'type':1, 'role':1, 'data-testid':1, 'data-test':1, 'data-cy':1, 'data-qa':1 };

  // Extract the attribute name that a CSS selector is based on
  function selectorWinningAttr(cssSel) {
    if (!cssSel) return null;
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

  ${SELECTOR_COMPUTATION_CODE}

  function getRole(el) {
    var explicit = el.getAttribute('role');
    if (explicit) return explicit.split(' ')[0];

    var tag = el.tagName.toLowerCase();
    var fn = IMPLICIT_ROLES[tag];
    if (fn) {
      var r = fn(el);
      if (r) return r;
    }

    if (el.getAttribute('contenteditable') === 'true') return 'textbox';
    if (el.hasAttribute('onclick') || el.hasAttribute('draggable')) return 'generic';
    if (el.hasAttribute('tabindex') && el.tabIndex >= 0) return 'generic';

    return null;
  }

  function getAccessibleName(el) {
    var ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();

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

    if (tag === 'img' || tag === 'input' && (el.getAttribute('type') || '').toLowerCase() === 'image') {
      var alt = el.getAttribute('alt');
      if (alt) return alt.trim();
    }

    if (['input','select','textarea'].indexOf(tag) !== -1) {
      var id = el.getAttribute('id');
      if (id) {
        var label = document.querySelector('label[for="' + id + '"]');
        if (label) return (label.textContent || '').trim();
      }
      var parentLabel = el.closest('label');
      if (parentLabel) {
        var clone = parentLabel.cloneNode(true);
        var inputs = clone.querySelectorAll('input,select,textarea');
        for (var i = 0; i < inputs.length; i++) inputs[i].remove();
        var lt = (clone.textContent || '').trim();
        if (lt) return lt;
      }
    }

    var ph = el.getAttribute('placeholder');
    if (ph) return ph.trim();

    var title = el.getAttribute('title');
    if (title) return title.trim();

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

    var childNodes = [];
    var children = node.children;
    for (var i = 0; i < children.length; i++) {
      var childResult = walk(children[i]);
      if (childResult) childNodes.push(childResult);
    }

    if (!role) {
      if (childNodes.length > 0) return { __promote: childNodes };
      return null;
    }

    var ref = null;
    if ((name || isLandmark) && refCount < maxElements) {
      refCount++;
      ref = 'e' + refCount;

      var tag = node.tagName.toLowerCase();
      var rect = node.getBoundingClientRect();
      var attrs = {};
      var nodeAttrs = node.attributes;
      for (var nai = 0; nai < nodeAttrs.length; nai++) {
        var aName = nodeAttrs[nai].name;
        var aVal = nodeAttrs[nai].value;
        if (aName === 'style' || aName === 'class' || aName === 'slot') continue;
        if (aName.indexOf('on') === 0 && aName.length > 2) continue;
        if (aName === 'data-reactid' || aName === 'data-reactroot' || aName === 'data-react-checksum') continue;
        if (!aVal || aVal.length > 200) continue;
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
      if (lastEl.ref === ref) {
        if (lastEl.css) treeNode.css = lastEl.css;
        if (lastEl.xpath) treeNode.xpath = lastEl.xpath;
      }
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

/** Options for formatting the accessibility tree. */
export interface FormatTreeOptions {
  maxLength?: number;
  mode?: SnapshotMode;
}

/**
 * Format a single node line.
 * In smart mode: truncate long names, show only one selector.
 */
function formatNodeLine(node: AccessibilityNode, indent: string, smart: boolean): string {
  let line = `${indent}- ${node.role}`;
  if (node.name) {
    let name = node.name;
    if (smart && name.length > 80) {
      name = name.slice(0, 77) + '...';
    }
    line += ` "${name}"`;
  }
  if (node.level !== undefined) line += ` [level=${node.level}]`;
  if (node.ref) {
    const sel = node.css || node.xpath;
    if (smart) {
      // Single best selector to save space
      line += sel ? ` [ref=${node.ref}, ${node.css ? 'css' : 'xpath'}=${sel}]` : ` [ref=${node.ref}]`;
    } else {
      if (node.css && node.xpath) {
        line += ` [ref=${node.ref}, css=${node.css}, xpath=${node.xpath}]`;
      } else if (sel) {
        line += ` [ref=${node.ref}, ${node.css ? 'css' : 'xpath'}=${sel}]`;
      } else {
        line += ` [ref=${node.ref}]`;
      }
    }
  }
  return line;
}

/** Count total ref'd elements in a subtree (memoized per call). */
function countRefs(node: AccessibilityNode, cache: Map<AccessibilityNode, number>): number {
  const cached = cache.get(node);
  if (cached !== undefined) return cached;
  let count = node.ref ? 1 : 0;
  for (const child of node.children) {
    count += countRefs(child, cache);
  }
  cache.set(node, count);
  return count;
}

/** Smart mode constants. */
const MAX_SMART_LINES = 200;
const SMART_REPEAT_SHOW = 2;       // Show first N of repeated siblings
const SMART_COLLAPSE_DEPTH = 3;    // Depth at which to collapse large subtrees
const SMART_COLLAPSE_THRESHOLD = 8; // Min descendant refs to trigger collapse

/**
 * Format an accessibility tree as indented text for snapshot output.
 */
export function formatAccessibilityTree(tree: AccessibilityNode, options?: FormatTreeOptions): string {
  const mode = options?.mode ?? 'full';
  const maxLength = options?.maxLength;
  const smart = mode === 'smart';

  if (mode === 'minimal') {
    return formatMinimal(tree, maxLength);
  }

  const lines: string[] = [];
  const refCache = smart ? new Map<AccessibilityNode, number>() : new Map();

  function walk(node: AccessibilityNode, depth: number): void {
    // Smart: hard line cap
    if (smart && lines.length >= MAX_SMART_LINES) return;

    if (smart) {
      const refs = countRefs(node, refCache);

      // Skip subtrees with zero interactive elements (except root-level landmarks)
      if (refs === 0 && depth > 0) return;

      // Flatten single-child wrappers that have no ref
      if (!node.ref && node.children.length === 1 && depth > 0) {
        walk(node.children[0], depth);
        return;
      }

      // Collapse large subtrees at depth
      if (depth >= SMART_COLLAPSE_DEPTH && refs > SMART_COLLAPSE_THRESHOLD) {
        const indent = '  '.repeat(depth);
        lines.push(formatNodeLine(node, indent, true));
        lines.push(`${indent}  - ... (${refs - (node.ref ? 1 : 0)} interactive elements inside)`);
        return;
      }
    }

    const indent = '  '.repeat(depth);
    lines.push(formatNodeLine(node, indent, smart));

    if (smart) {
      // Collapse repeated similar siblings (e.g., product cards, nav items)
      collapseChildren(node.children, depth + 1);
    } else {
      for (const child of node.children) {
        walk(child, depth + 1);
      }
    }
  }

  /** Group consecutive children with the same role and collapse repeats. */
  function collapseChildren(children: AccessibilityNode[], depth: number): void {
    let i = 0;
    while (i < children.length) {
      if (lines.length >= MAX_SMART_LINES) return;

      // Find run of siblings with same role
      const role = children[i].role;
      let runEnd = i + 1;
      while (runEnd < children.length && children[runEnd].role === role) {
        runEnd++;
      }
      const runLen = runEnd - i;

      if (runLen > SMART_REPEAT_SHOW + 1) {
        // Show first N, summarize rest
        for (let j = i; j < i + SMART_REPEAT_SHOW; j++) {
          walk(children[j], depth);
        }
        const skipped = runLen - SMART_REPEAT_SHOW;
        let skippedRefs = 0;
        for (let j = i + SMART_REPEAT_SHOW; j < runEnd; j++) {
          skippedRefs += countRefs(children[j], refCache);
        }
        const indent = '  '.repeat(depth);
        lines.push(`${indent}- ... (+${skipped} more ${role} items, ${skippedRefs} interactive elements)`);
      } else {
        for (let j = i; j < runEnd; j++) {
          walk(children[j], depth);
        }
      }
      i = runEnd;
    }
  }

  const roots = tree.role !== 'document' ? [tree] : tree.children;
  for (const child of roots) {
    walk(child, 0);
  }

  // Safety cap
  if (smart && lines.length > MAX_SMART_LINES) {
    lines.length = MAX_SMART_LINES;
    lines.push('\n... (truncated, use snapshotOptions.mode: "full" to see all)');
  }

  let text = lines.join('\n');
  if (maxLength && text.length > maxLength) {
    text = text.slice(0, maxLength) + '\n... (truncated)';
  }
  return text;
}

/**
 * Minimal mode: flat list of only ref'd elements with role, name, and selectors.
 */
function formatMinimal(tree: AccessibilityNode, maxLength?: number): string {
  const lines: string[] = [];

  function collect(node: AccessibilityNode): void {
    if (node.ref) {
      lines.push(formatNodeLine(node, '', false));
    }
    for (const child of node.children) {
      collect(child);
    }
  }

  if (tree.role !== 'document') {
    collect(tree);
  } else {
    for (const child of tree.children) {
      collect(child);
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
