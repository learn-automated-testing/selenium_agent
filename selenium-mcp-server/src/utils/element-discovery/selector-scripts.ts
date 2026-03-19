/**
 * Shared browser-side JS containing helper functions and computeSelector().
 * Embedded in both ACCESSIBILITY_TREE_SCRIPT and COMPUTE_SELECTOR_SCRIPT
 * to eliminate duplication. Must be ES5-compatible (runs in browser).
 */
export const SELECTOR_COMPUTATION_CODE = `
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

  // Check if an element is visible (non-zero size + not hidden via CSS)
  function isElVisible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    var s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    return true;
  }

  // Count visible matches for a CSS selector. Returns count (capped at 3 for perf).
  function countVisibleCss(selector) {
    try {
      var els = document.querySelectorAll(selector);
      if (els.length === 0) return 0;
      if (els.length === 1) return 1;
      var visible = 0;
      for (var i = 0; i < els.length && visible < 3; i++) {
        if (isElVisible(els[i])) visible++;
      }
      return visible;
    } catch (_) { return 0; }
  }

  // Check if CSS selector matches exactly 1 visible element
  function cssUnique(selector) {
    return countVisibleCss(selector) === 1;
  }

  function xpathUnique(xpath) {
    try {
      var r = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      if (r.snapshotLength === 1) return true;
      if (r.snapshotLength === 0 || r.snapshotLength > 10) return false;
      // Multiple matches — check if only 1 is visible
      var visible = 0;
      for (var i = 0; i < r.snapshotLength && visible < 3; i++) {
        if (isElVisible(r.snapshotItem(i))) visible++;
      }
      return visible === 1;
    } catch (_) { return false; }
  }

  function tryAttr(prefix, attr, value) {
    if (!value) return null;
    var escaped = value.replace(/"/g, '\\\\"');
    var exact = prefix + '[' + attr + '="' + escaped + '"]';
    if (cssUnique(exact)) return exact;
    if (value.length > 40) {
      var truncated = value.slice(0, 40).replace(/"/g, '\\\\"');
      var startsWith = prefix + '[' + attr + '^="' + truncated + '"]';
      if (cssUnique(startsWith)) return startsWith;
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

    // Shadow DOM: detect if element is inside a shadow root
    var queryRoot = el.getRootNode ? el.getRootNode() : document;
    var inShadowDom = queryRoot instanceof ShadowRoot;
    var origCountVisibleCss = countVisibleCss;
    var origCssUnique = cssUnique;
    var origXpathUnique = xpathUnique;
    if (inShadowDom) {
      // Override query functions to search within shadow root scope
      countVisibleCss = function(selector) {
        try {
          var els = queryRoot.querySelectorAll(selector);
          if (els.length === 0) return 0;
          if (els.length === 1) return 1;
          var visible = 0;
          for (var i = 0; i < els.length && visible < 3; i++) {
            if (isElVisible(els[i])) visible++;
          }
          return visible;
        } catch (_) { return 0; }
      };
      cssUnique = function(selector) { return countVisibleCss(selector) === 1; };
      // XPath cannot cross shadow boundaries — disable
      xpathUnique = function() { return false; };
    }

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

    // Walk up ancestors to find a scoping context: parent with #id, landmark with aria-label,
    // or positional landmark. Returns { cssPrefix, xpathPrefix } or null.
    function findAncestorScope(e) {
      var ancestor = e.parentElement;
      for (var d = 0; d < 8 && ancestor; d++) {
        var aTag = ancestor.tagName.toLowerCase();
        if (aTag === 'body' || aTag === 'html') break;

        // Best: ancestor with unique ID
        var aId = ancestor.getAttribute('id');
        if (aId) {
          try {
            if (document.querySelectorAll('#' + cssEscape(aId)).length === 1) {
              return {
                cssPrefix: '#' + cssEscape(aId) + ' ',
                xpathPrefix: '//*[@id=' + xpathStringLiteral(aId) + ']//'
              };
            }
          } catch (_) {}
        }

        // Next: ancestor with a semantic attribute (placeholder, data-test, etc.)
        var SCOPE_ATTRS = ['placeholder', 'data-testid', 'data-test', 'data-cy', 'data-qa', 'name'];
        for (var sai = 0; sai < SCOPE_ATTRS.length; sai++) {
          var saName = SCOPE_ATTRS[sai];
          var saVal = ancestor.getAttribute(saName);
          if (saVal) {
            var saEscaped = saVal.replace(/"/g, '\\\\"');
            var saCss = aTag + '[' + saName + '="' + saEscaped + '"]';
            try {
              if (document.querySelectorAll(saCss).length === 1) {
                return {
                  cssPrefix: saCss + ' ',
                  xpathPrefix: '//' + aTag + '[@' + saName + '=' + xpathStringLiteral(saVal) + ']//'
                };
              }
            } catch (_) {}
          }
        }

        // Next: landmark with aria-label (e.g. nav[aria-label="Main navigation"])
        var isLandmark = LANDMARK_TAGS[aTag] || (aTag === 'section' && (ancestor.hasAttribute('aria-label') || ancestor.hasAttribute('aria-labelledby')));
        if (isLandmark) {
          var aLabel = ancestor.getAttribute('aria-label');
          if (aLabel) {
            var cssSel = aTag + '[aria-label="' + aLabel.replace(/"/g, '\\\\"') + '"]';
            try {
              if (document.querySelectorAll(cssSel).length === 1) {
                return {
                  cssPrefix: cssSel + ' ',
                  xpathPrefix: '//' + aTag + '[@aria-label=' + xpathStringLiteral(aLabel) + ']//'
                };
              }
            } catch (_) {}
          }

          // Landmark without aria-label but unique tag
          try {
            if (document.querySelectorAll(aTag).length === 1) {
              return {
                cssPrefix: aTag + ' ',
                xpathPrefix: '//' + aTag + '//'
              };
            }
          } catch (_) {}

          // Positional landmark: nav:nth-of-type(N)
          var allSame = document.querySelectorAll(aTag);
          if (allSame.length > 1) {
            for (var li = 0; li < allSame.length; li++) {
              if (allSame[li] === ancestor) {
                var pos = li + 1;
                return {
                  cssPrefix: aTag + ':nth-of-type(' + pos + ') ',
                  xpathPrefix: '(//' + aTag + ')[' + pos + ']//'
                };
              }
            }
          }
        }

        // Also check role-based landmarks
        var aRole = ancestor.getAttribute('role');
        if (aRole && ['navigation','main','banner','contentinfo','complementary','search','form','region'].indexOf(aRole) !== -1) {
          var roleLabel = ancestor.getAttribute('aria-label');
          if (roleLabel) {
            var cssSel = '[role="' + aRole + '"][aria-label="' + roleLabel.replace(/"/g, '\\\\"') + '"]';
            try {
              if (document.querySelectorAll(cssSel).length === 1) {
                return {
                  cssPrefix: cssSel + ' ',
                  xpathPrefix: '//*[@role=' + xpathStringLiteral(aRole) + '][@aria-label=' + xpathStringLiteral(roleLabel) + ']//'
                };
              }
            } catch (_) {}
          }
          var roleSel = '[role="' + aRole + '"]';
          try {
            if (document.querySelectorAll(roleSel).length === 1) {
              return {
                cssPrefix: roleSel + ' ',
                xpathPrefix: '//*[@role=' + xpathStringLiteral(aRole) + ']//'
              };
            }
          } catch (_) {}
        }

        ancestor = ancestor.parentElement;
      }
      return null;
    }

    // Try a CSS selector with ancestor scope fallback. Returns unique selector or null.
    function tryWithScope(cssSelector, scope) {
      // First try unscoped
      if (cssUnique(cssSelector)) return cssSelector;
      // Then try scoped
      if (scope) {
        var scoped = scope.cssPrefix + cssSelector;
        if (cssUnique(scoped)) return scoped;
      }
      return null;
    }

    // Try an XPath with ancestor scope fallback. Returns unique xpath or null.
    function tryXpathWithScope(innerTag, innerPredicate, scope) {
      var xp = '//' + innerTag + innerPredicate;
      if (xpathUnique(xp)) return xp;
      if (scope) {
        xp = scope.xpathPrefix + innerTag + innerPredicate;
        if (xpathUnique(xp)) return xp;
      }
      return null;
    }

    // --- Phase 0: selectorHints — user-taught preferred selectors ---
    if (typeof selectorHints !== 'undefined' && selectorHints && selectorHints.length > 0) {
      var elText = (el.textContent || '').trim();
      var elAriaLabel = el.getAttribute('aria-label') || '';
      for (var hi = 0; hi < selectorHints.length; hi++) {
        var hint = selectorHints[hi];
        if (hint.tag && hint.tag !== tag) continue;
        var matchText = hint.text ? (elText === hint.text || elText.indexOf(hint.text) === 0) : false;
        var matchAria = hint.ariaLabel ? (elAriaLabel === hint.ariaLabel) : false;
        if (!matchText && !matchAria) continue;
        // Validate hint still resolves to exactly 1 visible element pointing to THIS element
        if (cssUnique(hint.css)) {
          try {
            var hintEl = document.querySelector(hint.css);
            if (hintEl === el) {
              result.css = hint.css;
              return result;
            }
          } catch (_) {}
        }
      }
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

    // --- Compute ancestor scope once (used by multiple phases) ---
    var scope = findAncestorScope(el);

    // --- Phase 2: byTestId — data-testid, data-test, data-cy, data-qa ---
    var TEST_ID_ATTRS = ['data-testid', 'data-test', 'data-cy', 'data-qa'];
    for (var ti = 0; ti < TEST_ID_ATTRS.length; ti++) {
      var tAttr = TEST_ID_ATTRS[ti];
      var tVal = el.getAttribute(tAttr);
      if (tVal) {
        // Try unique without scope first
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
        // Try with ancestor scope (e.g. data-test="time-picker" inside scoped parent)
        if (scope) {
          var scopedTestCss = tag + '[' + tAttr + '="' + tVal.replace(/"/g, '\\\\"') + '"]';
          var scopedSel = tryWithScope(scopedTestCss, scope);
          if (!scopedSel) {
            scopedTestCss = '[' + tAttr + '="' + tVal.replace(/"/g, '\\\\"') + '"]';
            scopedSel = tryWithScope(scopedTestCss, scope);
          }
          if (scopedSel) {
            result.css = scopedSel;
            xp = tryXpathWithScope(tag, '[@' + tAttr + '=' + xpathStringLiteral(tVal) + ']', scope);
            if (xp) result.xpath = xp;
            return result;
          }
        }
      }
    }

    // --- Phase 2b: byDescendantTestId — child/descendant has data-test* attr ---
    // When the element itself lacks a test ID, check direct children for one.
    // Use :has() CSS selector or XPath descendant to anchor to the child's test ID.
    for (var dti = 0; dti < TEST_ID_ATTRS.length; dti++) {
      var dtAttr = TEST_ID_ATTRS[dti];
      // Check direct children (up to 10)
      var dtChildren = el.children;
      for (var dci = 0; dci < dtChildren.length && dci < 10; dci++) {
        var dtVal = dtChildren[dci].getAttribute(dtAttr);
        if (!dtVal) continue;
        var dtChildTag = dtChildren[dci].tagName.toLowerCase();
        // Try :has(> child[data-test="..."]) — supported in modern browsers
        var hasCss = tag + ':has(> ' + dtChildTag + '[' + dtAttr + '="' + dtVal.replace(/"/g, '\\\\"') + '"])';
        s = tryWithScope(hasCss, scope);
        if (s) {
          result.css = s;
          // XPath equivalent: //tag[childTag[@data-test="..."]]
          xp = tryXpathWithScope(tag, '[' + dtChildTag + '[@' + dtAttr + '=' + xpathStringLiteral(dtVal) + ']]', scope);
          if (xp) result.xpath = xp;
          return result;
        }
        // Also try without child tag constraint
        hasCss = tag + ':has([' + dtAttr + '="' + dtVal.replace(/"/g, '\\\\"') + '"])';
        s = tryWithScope(hasCss, scope);
        if (s) {
          result.css = s;
          xp = tryXpathWithScope(tag, '[.//' + dtChildTag + '[@' + dtAttr + '=' + xpathStringLiteral(dtVal) + ']]', scope);
          if (xp) result.xpath = xp;
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
    // Also consider explicit role attribute (e.g. div[role="button"])
    if (!implicitRole) {
      var explicitRole = el.getAttribute('role');
      if (explicitRole) {
        implicitRole = explicitRole;
      }
    }
    if (implicitRole) {
      var ariaLabel = el.getAttribute('aria-label');
      var textContent = getVisibleText(el, 60);

      // Try aria-label first (works in both CSS and XPath)
      if (ariaLabel) {
        var cssCandidate = tag + '[aria-label="' + ariaLabel.replace(/"/g, '\\\\"') + '"]';
        s = tryWithScope(cssCandidate, scope);
        if (s) {
          result.css = s;
          xp = tryXpathWithScope(tag, '[@aria-label=' + xpathStringLiteral(ariaLabel) + ']', scope);
          if (xp) result.xpath = xp;
          return result;
        }
      }

      // Try text content (XPath only — CSS can't match text)
      if (textContent) {
        xp = tryXpathWithScope(tag, '[normalize-space()=' + xpathStringLiteral(textContent) + ']', scope);
        if (xp) {
          result.xpath = xp;
          // Also try CSS scope with href/name for links/buttons
          if (tag === 'a') {
            var href = el.getAttribute('href');
            if (href) {
              var hrefCss = tryWithScope(tag + '[href="' + href.replace(/"/g, '\\\\"') + '"]', scope);
              if (hrefCss) result.css = hrefCss;
            }
          }
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

    // --- Phase 6: byText — visible text content, with ancestor scope fallback ---
    if (TEXT_TAGS[tag]) {
      var exactText = getVisibleText(el, 60);
      if (exactText) {
        xp = tryXpathWithScope(tag, '[normalize-space()=' + xpathStringLiteral(exactText) + ']', scope);
        if (xp) {
          result.xpath = xp;
          // Try CSS scope with href for links
          if (tag === 'a' && scope) {
            var href = el.getAttribute('href');
            if (href) {
              var hrefCss = tryWithScope(tag + '[href="' + href.replace(/"/g, '\\\\"') + '"]', scope);
              if (hrefCss) result.css = hrefCss;
            }
          }
          return result;
        }
      }
    }

    // --- Phase 7: byAttribute — meaningful attributes, with ancestor scope fallback ---
    var ATTR_PRIORITY = [
      'name', 'title', 'alt', 'hreflang', 'href', 'src', 'action',
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
        var attrCss = tag + '[' + aName + '="' + aVal.replace(/"/g, '\\\\"') + '"]';
        s = tryWithScope(attrCss, scope);
        if (s) {
          result.css = s;
          if (aVal.length <= 60) {
            xp = tryXpathWithScope(tag, '[@' + aName + '=' + xpathStringLiteral(aVal) + ']', scope);
            if (xp) result.xpath = xp;
          }
          return result;
        }
        // Also try starts-with for long values
        if (aVal.length > 40) {
          var truncated = aVal.slice(0, 40).replace(/"/g, '\\\\"');
          var startsWith = tag + '[' + aName + '^="' + truncated + '"]';
          s = tryWithScope(startsWith, scope);
          if (s) {
            result.css = s;
            return result;
          }
        }
      }
    }
    // Dynamic discovery — try ALL remaining attributes with scope
    var attrs = el.attributes;
    if (attrs) {
      for (var di = 0; di < attrs.length; di++) {
        var dName = attrs[di].name;
        if (SKIP_ATTRS[dName] || tried[dName]) continue;
        if (dName.indexOf('on') === 0 && dName.length > 2) continue;
        var dVal = attrs[di].value;
        if (!dVal || dVal.length > 60) continue;
        var dynCss = tag + '[' + dName + '="' + dVal.replace(/"/g, '\\\\"') + '"]';
        s = tryWithScope(dynCss, scope);
        if (s) {
          result.css = s;
          xp = tryXpathWithScope(tag, '[@' + dName + '=' + xpathStringLiteral(dVal) + ']', scope);
          if (xp) result.xpath = xp;
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
      if (cssUnique(roleSelector)) {
        result.css = roleSelector;
        xp = '//*[@role=' + xpathStringLiteral(elRole) + ']';
        if (xpathUnique(xp)) result.xpath = xp;
        return result;
      }
    }

    // --- Phase 10: byState — stateful selectors (dialog[open], aria-expanded) ---
    if ((tag === 'dialog' || tag === 'details') && el.hasAttribute('open')) {
      var openSelector = tag + '[open]';
      if (cssUnique(openSelector)) {
        result.css = openSelector;
        result.xpath = '//' + tag + '[@open]';
        return result;
      }
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
          if (cssUnique(compound)) {
            result.css = compound;
            xp = '//' + tag + '[@' + usable[p1].n + '=' + xpathStringLiteral(usable[p1].v) + '][@' + usable[p2].n + '=' + xpathStringLiteral(usable[p2].v) + ']';
            if (xpathUnique(xp)) result.xpath = xp;
            return result;
          }
        }
      }
      // class + attribute compound
      if (el.classList && el.classList.length > 0) {
        for (var cci = 0; cci < el.classList.length && cci < 3; cci++) {
          var ccls = el.classList[cci];
          if (isNonSemanticClass(ccls)) continue;
          for (var cai = 0; cai < maxPairs; cai++) {
            var clsCompound = tag + '.' + cssEscape(ccls) + '[' + usable[cai].n + '="' + usable[cai].v.replace(/"/g, '\\\\"') + '"]';
            if (cssUnique(clsCompound)) {
              result.css = clsCompound;
              return result;
            }
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
        if (cssUnique(clsSelector)) {
          result.css = clsSelector;
          xp = '//' + tag + '[contains(@class,' + xpathStringLiteral(cls) + ')]';
          if (xpathUnique(xp)) result.xpath = xp;
          return result;
        }
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
      for (var depth = 0; depth < 5 && anc; depth++) {
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
        // Add nth-of-type to ancestor when it has same-tag siblings
        var ancNth = '';
        var ancParent = anc.parentElement;
        if (ancParent) {
          var sameTagCount = 0;
          var ancSibIdx = 0;
          var ancSibs = ancParent.children;
          for (var asi = 0; asi < ancSibs.length; asi++) {
            if (ancSibs[asi].tagName === anc.tagName) {
              sameTagCount++;
              if (ancSibs[asi] === anc) ancSibIdx = sameTagCount;
            }
          }
          if (sameTagCount > 1) ancNth = ':nth-of-type(' + ancSibIdx + ')';
        }
        chain = ancTag + ancClass + ancNth + ' > ' + chain;
        anc = anc.parentElement;
      }
      var idxSelector = '/*idx*/ ' + chain;
      if (cssUnique(chain)) {
        result.css = idxSelector;
        return result;
      }
      // Try with ancestor scope prefix
      if (scope) {
        var scopedChain = scope.cssPrefix + chain;
        if (cssUnique(scopedChain)) {
          result.css = '/*idx*/ ' + scopedChain;
          return result;
        }
      }
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

    // --- Phase 16: byPositionalIndex — nth match among elements sharing attr/text ---
    // When all phases failed, find this element's position among all matches of a
    // good base selector (data-test, text, etc.) and produce (xpath)[N].
    var positionalBases = [];
    for (var pti = 0; pti < TEST_ID_ATTRS.length; pti++) {
      var ptVal = el.getAttribute(TEST_ID_ATTRS[pti]);
      if (ptVal) {
        positionalBases.push('//' + tag + '[@' + TEST_ID_ATTRS[pti] + '=' + xpathStringLiteral(ptVal) + ']');
      }
    }
    var posText = getVisibleText(el, 60);
    if (posText) {
      positionalBases.push('//' + tag + '[normalize-space()=' + xpathStringLiteral(posText) + ']');
    }
    for (var pbi = 0; pbi < positionalBases.length; pbi++) {
      try {
        var xpRes = document.evaluate(positionalBases[pbi], document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        if (xpRes.snapshotLength > 1 && xpRes.snapshotLength <= 20) {
          for (var xpi = 0; xpi < xpRes.snapshotLength; xpi++) {
            if (xpRes.snapshotItem(xpi) === el) {
              result.xpath = '(' + positionalBases[pbi] + ')[' + (xpi + 1) + ']';
              return result;
            }
          }
        }
      } catch (_) {}
    }

    // Shadow DOM: prefix CSS selector with host path using >>> notation
    if (inShadowDom && result.css) {
      var hostEl = queryRoot.host;
      // Restore document-scoped functions to compute host selector
      countVisibleCss = origCountVisibleCss;
      cssUnique = origCssUnique;
      xpathUnique = origXpathUnique;
      var hostSel = computeSelector(hostEl);
      if (hostSel.css) {
        result.css = hostSel.css + ' >>> ' + result.css;
      }
      result.xpath = null; // XPath cannot cross shadow boundaries
    }
    // Restore original functions
    if (inShadowDom) {
      countVisibleCss = origCountVisibleCss;
      cssUnique = origCssUnique;
      xpathUnique = origXpathUnique;
    }

    return result;
  }
`;
