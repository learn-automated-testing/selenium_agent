import { SELECTOR_COMPUTATION_CODE } from './selector-scripts.js';

/**
 * Browser-side JS that walks the DOM recursively, computes ARIA roles and
 * accessible names, assigns refs to semantic elements, and returns both a
 * flat element list and a hierarchical accessibility tree.
 */
export const ACCESSIBILITY_TREE_SCRIPT = `
  var scopeSelector = arguments[0];
  var maxElements = arguments[1];
  var verboseAttrs = arguments[2];
  var selectorHints = arguments[3] || [];

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

    // Discover non-interactive elements with test-anchor attributes or custom elements
    var _TEST_ANCHORS = ['data-testid', 'data-test', 'data-cy', 'data-qa'];
    for (var _tai = 0; _tai < _TEST_ANCHORS.length; _tai++) {
      if (el.hasAttribute(_TEST_ANCHORS[_tai])) return 'generic';
    }
    // Custom HTML elements (web components) — tag contains hyphen
    if (tag.indexOf('-') !== -1) return 'generic';

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
  var deferredGeneric = []; // test-anchor/custom elements deferred to pass 2

  function assignRef(node, ref, role, name, level, treeNode) {
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

    treeNode.ref = ref;
    if (selectorResult.css) treeNode.css = selectorResult.css;
    if (selectorResult.xpath) treeNode.xpath = selectorResult.xpath;
  }

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
          // Shadow DOM: also traverse open shadow roots
          if (node.shadowRoot) {
            var _sc = node.shadowRoot.children;
            for (var _si = 0; _si < _sc.length; _si++) {
              var _sr = walk(_sc[_si]);
              if (_sr) _children.push(_sr);
            }
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
    // Shadow DOM: also traverse open shadow roots
    if (node.shadowRoot) {
      var shadowChildren = node.shadowRoot.children;
      for (var sci = 0; sci < shadowChildren.length; sci++) {
        var shadowResult = walk(shadowChildren[sci]);
        if (shadowResult) childNodes.push(shadowResult);
      }
    }

    if (!role) {
      if (childNodes.length > 0) return { __promote: childNodes };
      return null;
    }

    // For generic elements discovered via attributes, use a meaningful attr as fallback name
    if (!name && role === 'generic') {
      var _FALLBACK_ATTRS = ['data-testid', 'data-test', 'data-cy', 'data-qa', 'name', 'title', 'alt'];
      for (var _fai = 0; _fai < _FALLBACK_ATTRS.length; _fai++) {
        var _fv = node.getAttribute(_FALLBACK_ATTRS[_fai]);
        if (_fv) { name = _fv; break; }
      }
      // Last resort: use the first meaningful attribute value
      if (!name) {
        var _nodeAttrs = node.attributes;
        var _SKIP_NAME = { 'class':1, 'style':1, 'slot':1, 'id':1, 'dir':1, 'lang':1, 'hidden':1, 'tabindex':1, 'draggable':1, 'width':1, 'height':1 };
        for (var _fni = 0; _fni < _nodeAttrs.length; _fni++) {
          var _fnName = _nodeAttrs[_fni].name;
          if (_SKIP_NAME[_fnName]) continue;
          if (_fnName.indexOf('on') === 0 && _fnName.length > 2) continue;
          if (_nodeAttrs[_fni].value) { name = _fnName + '=' + _nodeAttrs[_fni].value; break; }
        }
      }
    }

    // Determine if this is a low-priority generic element (test anchor / custom element)
    var isGenericDiscovery = role === 'generic' && !node.hasAttribute('onclick') &&
      !node.hasAttribute('draggable') && !(node.hasAttribute('tabindex') && node.tabIndex >= 0) &&
      node.getAttribute('contenteditable') !== 'true';

    var ref = null;
    var treeChildren = flatten(childNodes);
    var treeNode = {
      role: role,
      name: name.slice(0, 100),
      children: treeChildren
    };
    if (level !== undefined) treeNode.level = level;

    if ((name || isLandmark) && !isGenericDiscovery && refCount < maxElements) {
      // Pass 1: assign ref immediately to role-bearing elements
      refCount++;
      ref = 'e' + refCount;
      assignRef(node, ref, role, name, level, treeNode);
    } else if ((name || isLandmark) && isGenericDiscovery) {
      // Pass 2 candidate: defer test-anchor/custom elements
      deferredGeneric.push({ node: node, role: role, name: name, level: level, treeNode: treeNode });
    }

    if (ref) treeNode.ref = ref;

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

  // Pass 2: assign refs to deferred test-anchor/custom elements with remaining budget
  for (var di = 0; di < deferredGeneric.length && refCount < maxElements; di++) {
    var d = deferredGeneric[di];
    refCount++;
    var dRef = 'e' + refCount;
    assignRef(d.node, dRef, d.role, d.name, d.level, d.treeNode);
  }

  return { elements: elements, tree: tree };
`;
