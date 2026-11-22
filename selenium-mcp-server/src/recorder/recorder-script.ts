/**
 * The recorder that runs inside the page while the user clicks through their app themselves (record mode).
 * It records clicks, typed values (passwords masked), selects, checkboxes and Enter, each with a stable locator,
 * and offers a small toolbar to mark expected results without the chat: Check text, Check visible and a note.
 * Events go to localStorage (key below) so they survive page loads on the same site; Node reads and clears them.
 *
 * It is a plain function so it can be sent to the browser as a string (execute script or a BiDi preload script).
 */
export const RECORDER_STORAGE_KEY = '__selenium_ai_agent_recording';

export const RECORDER_FUNCTION = `function seleniumAiAgentRecorder() {
  if (window.__saaRecorder) return;
  window.__saaRecorder = true;
  var KEY = ${JSON.stringify(RECORDER_STORAGE_KEY)};
  var mode = 'record';
  var host;

  function push(ev) {
    ev.t = Date.now();
    ev.url = location.href;
    try {
      var list = JSON.parse(localStorage.getItem(KEY) || '[]');
      list.push(ev);
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) { /* storage full or blocked: skip */ }
  }
  function q(s) { return '"' + String(s).replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"') + '"'; }
  function stableId(id) { return id && !/\\d{3,}|[a-f0-9]{8,}|^(ember|react|mui|radix|headlessui)/i.test(id); }
  function text(el) { return (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim(); }
  function unique(css) { try { return document.querySelectorAll(css).length === 1; } catch (e) { return false; } }
  function labelOf(el) {
    if (el.id) { var l = document.querySelector('label[for=' + q(el.id) + ']'); if (l) return text(l); }
    var p = el.closest('label'); if (p) return text(p);
    return el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
  }
  function cssPath(el) {
    var parts = [];
    while (el && el.nodeType === 1 && parts.length < 4) {
      var tag = el.tagName.toLowerCase();
      if (stableId(el.id)) { parts.unshift('#' + CSS.escape(el.id)); break; }
      var i = 1, s = el;
      while ((s = s.previousElementSibling)) if (s.tagName === el.tagName) i++;
      parts.unshift(tag + ':nth-of-type(' + i + ')');
      el = el.parentElement;
    }
    return parts.join(' > ');
  }
  function locator(el) {
    var tag = el.tagName.toLowerCase();
    var attrs = ['data-testid', 'data-test', 'data-qa', 'data-cy'];
    for (var i = 0; i < attrs.length; i++) {
      var v = el.getAttribute(attrs[i]);
      if (v && unique('[' + attrs[i] + '=' + q(v) + ']')) return { css: '[' + attrs[i] + '=' + q(v) + ']' };
    }
    if (stableId(el.id) && unique('#' + CSS.escape(el.id))) return { css: '#' + CSS.escape(el.id) };
    var name = el.getAttribute('name');
    if (name && unique(tag + '[name=' + q(name) + ']')) return { css: tag + '[name=' + q(name) + ']' };
    var aria = el.getAttribute('aria-label');
    if (aria && unique(tag + '[aria-label=' + q(aria) + ']')) return { css: tag + '[aria-label=' + q(aria) + ']' };
    var t = text(el);
    if ((tag === 'button' || tag === 'a') && t && t.length <= 60 && t.indexOf("'") === -1) {
      var xp = '//' + tag + "[normalize-space()='" + t + "']";
      if (document.evaluate('count(' + xp + ')', document, null, XPathResult.NUMBER_TYPE, null).numberValue === 1) return { xpath: xp };
    }
    if (tag === 'button' || (tag === 'input' && /submit|button/.test(el.type))) {
      var css = tag + '[type=' + q(el.type) + ']';
      if (unique(css)) return { css: css };
    }
    return { css: cssPath(el) };
  }
  function describe(el) {
    var tag = el.tagName.toLowerCase();
    var role = tag === 'a' ? 'link' : tag === 'button' || (tag === 'input' && /submit|button/.test(el.type)) ? 'button'
      : tag === 'select' ? 'dropdown' : tag === 'input' && el.type === 'checkbox' ? 'checkbox' : tag === 'input' && el.type === 'radio' ? 'radio button'
      : tag === 'input' || tag === 'textarea' ? 'field' : tag;
    var name = role === 'field' || role === 'dropdown' || role === 'checkbox' || role === 'radio button' ? labelOf(el) : (text(el) || el.value || labelOf(el));
    return role + (name ? ' "' + name.slice(0, 60) + '"' : '');
  }
  function fromToolbar(e) { return host && e.composedPath && e.composedPath().indexOf(host) !== -1; }
  function target(e) {
    var el = e.target;
    if (!(el instanceof Element)) return null;
    return el.closest('a,button,input,select,textarea,label,[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[onclick]') || el;
  }

  document.addEventListener('click', function (e) {
    if (fromToolbar(e)) return;
    var el = target(e); if (!el) return;
    if (mode !== 'record') {
      e.preventDefault(); e.stopPropagation();
      var visibleEl = e.target instanceof Element ? e.target : el;
      if (mode === 'text') push({ type: 'expect-text', locator: locator(visibleEl), element: describe(visibleEl), text: text(visibleEl).slice(0, 200) });
      else push({ type: 'expect-visible', locator: locator(visibleEl), element: describe(visibleEl) });
      setMode('record');
      return;
    }
    var tag = el.tagName.toLowerCase();
    if ((tag === 'input' && !/submit|button|checkbox|radio|image/.test(el.type)) || tag === 'textarea' || tag === 'select') return;
    if (tag === 'input' && /checkbox|radio/.test(el.type)) return;
    push({ type: 'click', locator: locator(el), element: describe(el) });
  }, true);

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!(el instanceof Element) || fromToolbar(e)) return;
    var tag = el.tagName.toLowerCase();
    if (tag === 'select') push({ type: 'select', locator: locator(el), element: describe(el), value: el.options[el.selectedIndex] ? text(el.options[el.selectedIndex]) : el.value });
    else if (tag === 'input' && /checkbox|radio/.test(el.type)) push({ type: el.checked ? 'check' : 'uncheck', locator: locator(el), element: describe(el) });
    else if (tag === 'input' || tag === 'textarea') push({ type: 'type', locator: locator(el), element: describe(el), value: el.type === 'password' ? '<password>' : el.value, secret: el.type === 'password' });
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || fromToolbar(e)) return;
    var el = e.target;
    if (el instanceof Element && /^(input)$/i.test(el.tagName)) {
      if (!/checkbox|radio|submit|button/.test(el.type)) push({ type: 'type', locator: locator(el), element: describe(el), value: el.type === 'password' ? '<password>' : el.value, secret: el.type === 'password' });
      push({ type: 'press', key: 'Enter', locator: locator(el), element: describe(el) });
    }
  }, true);

  function setMode(m) {
    mode = m;
    if (!host) return;
    var root = host.shadowRoot;
    root.getElementById('hint').textContent = m === 'text' ? 'Click the text you expect' : m === 'visible' ? 'Click the element that must be visible' : 'Recording your clicks';
    root.getElementById('text').className = m === 'text' ? 'on' : '';
    root.getElementById('visible').className = m === 'visible' ? 'on' : '';
    document.documentElement.style.cursor = m === 'record' ? '' : 'crosshair';
  }
  function toolbar() {
    if (host || !document.body) return;
    host = document.createElement('selenium-ai-agent-recorder');
    host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;';
    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>div{font:13px -apple-system,Segoe UI,sans-serif;background:#111827;color:#f9fafb;border-radius:12px;padding:10px 12px;display:flex;gap:8px;align-items:center;box-shadow:0 6px 24px rgba(0,0,0,.25)}' +
      'b{color:#f87171}button{font:600 12px inherit;border:1px solid #374151;background:#1f2937;color:#f9fafb;border-radius:8px;padding:6px 10px;cursor:pointer}button.on{background:#2563eb;border-color:#2563eb}' +
      'input{font:12px inherit;border:1px solid #374151;background:#0b1220;color:#f9fafb;border-radius:8px;padding:6px 8px;width:170px}</style>' +
      '<div><b>●</b><span id="hint">Recording your clicks</span><button id="text">Check text</button><button id="visible">Check visible</button>' +
      '<input id="note" placeholder="Note or expectation, Enter"></div>';
    root.getElementById('text').onclick = function () { setMode(mode === 'text' ? 'record' : 'text'); };
    root.getElementById('visible').onclick = function () { setMode(mode === 'visible' ? 'record' : 'visible'); };
    root.getElementById('note').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && this.value.trim()) { push({ type: 'note', text: this.value.trim() }); this.value = ''; this.placeholder = 'Saved. Another note?'; }
    });
    document.body.appendChild(host);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', toolbar); else toolbar();
  push({ type: 'page', title: document.title });
}`;
