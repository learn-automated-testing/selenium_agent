/**
 * Helper code that generated tests use for elements in shadow DOM WebDriver cannot reach.
 *
 * Salesforce Lightning (LWC synthetic shadow DOM) patches the page's DOM APIs, so find_element cannot see these
 * elements, shadow_root fails ("no such shadow root") and elements returned from JavaScript are stale at once.
 * The helpers do what the agent's own tools do: find the element in the page with a deep CSS query (a plain
 * selector or a "host >>> inner" path), wait until it is visible and not covered, and act with real mouse and
 * keyboard input at its position. They also work for ordinary (native) shadow DOM.
 *
 * One helper file per language: deep_shadow.py (pytest and Robot Framework), deep-shadow.js, DeepShadow.java.
 */
import { DEEP_QUERY } from './shadow-dom.js';

/** In-page functions shared by every helper call (plain JavaScript, ES5). */
export const PAGE_LIB = `${DEEP_QUERY}
function firstVisible(path) { return queryAllPath(path).filter(function (e) { return e.getClientRects().length > 0; })[0] || null; }
function centreHit(el) {
  var r = el.getBoundingClientRect();
  var x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
  var top = document.elementFromPoint(x, y);
  while (top && top.shadowRoot && top.shadowRoot.elementFromPoint) {
    var inner = top.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === top) break;
    top = inner;
  }
  var hit = false;
  for (var n = top; n; n = n.parentNode || n.host || null) { if (n === el) { hit = true; break; } }
  return { x: x, y: y, hit: hit };
}
function point(path) { var el = firstVisible(path); if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); return centreHit(el); }
function label(e) { return (e.innerText || e.textContent || '').trim().replace(/\\s+/g, ' '); }
function optionPoint(text) {
  var opts = deepQueryAll(document, '[role="option"]').filter(function (e) { return e.getClientRects().length > 0; });
  var el = opts.filter(function (e) { return label(e) === text || e.getAttribute('data-value') === text; })[0];
  if (!el) return { found: false, hit: false, options: opts.map(label) };
  el.scrollIntoView({ block: 'nearest' });
  var p = centreHit(el); p.found = true; p.options = []; return p;
}
function state(path) {
  var all = queryAllPath(path);
  var el = all.filter(function (e) { return e.getClientRects().length > 0; })[0] || all[0];
  if (!el) return null;
  var s = getComputedStyle(el);
  return { value: typeof el.value === 'string' ? el.value : null, text: label(el),
    visible: el.getClientRects().length > 0 && s.visibility !== 'hidden' && s.display !== 'none' };
}
function selectContent(path) {
  var el = firstVisible(path);
  if (!el) return 0;
  if (typeof el.select === 'function') { el.select(); return (el.value || '').length; }
  if (el.isContentEditable) { var range = document.createRange(); range.selectNodeContents(el); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); return (el.textContent || '').length; }
  return 0;
}
`;

export type HelperLanguage = 'python' | 'javascript' | 'java';

export interface ShadowHelper {
  language: HelperLanguage;
  filename: string;
  /** How a test loads the helper. */
  usage: string;
  code: string;
}

/** The helper language for a generator framework, or null for frameworks that are not Selenium WebDriver. */
export function helperLanguageFor(framework: string | undefined): HelperLanguage | null {
  const f = (framework || 'selenium-python-pytest').toLowerCase();
  if (/playwright|cypress|webdriverio|wdio|csharp|nunit|xunit|mstest|dotnet|ruby|kotlin/.test(f)) return null;
  if (/java(?!script)|maven|gradle|junit|testng/.test(f)) return 'java';
  if (/javascript|\bjs\b|-js-|typescript|\bts\b|mocha|jest/.test(f)) return 'javascript';
  return 'python';
}

/** Locator code for an element in shadow DOM, calling the helper. */
export function deepCallSnippets(path: string): Record<string, string> {
  const sq = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const dq = (s: string) => JSON.stringify(s);
  return {
    python: `deep_click(${sq(path)}, driver)  # also deep_type(path, text, driver), deep_select(path, option, driver), deep_text(path, driver)`,
    robot: `Deep Click    ${path}    # also Deep Type / Deep Select / Deep Text / Deep Value / Deep Wait Visible (Library    deep_shadow.py)`,
    javascript: `await deepClick(driver, ${sq(path)})  // also deepType(driver, path, text), deepSelect(driver, path, option), deepText(driver, path)`,
    java: `DeepShadow.click(driver, ${dq(path)}); // also DeepShadow.type(driver, path, text), select(driver, path, option), text(driver, path)`,
  };
}

const HEADER = 'Selenium helpers for elements inside shadow DOM, including Salesforce Lightning (LWC synthetic shadow DOM).';
const WHY =
  'Salesforce\'s synthetic shadow DOM hides these elements from WebDriver: find_element cannot see them and ' +
  'shadow_root fails. These helpers find the element in the page with a deep CSS query (a plain selector or a ' +
  '"host >>> inner" path) and act with real mouse and keyboard input at its position, after waiting until it is ' +
  'visible and not covered by another element.';

function pythonHelper(): string {
  return `"""${HEADER}

${WHY}

pytest:          deep_click('a[title="New"]', driver)
Robot Framework: Library    deep_shadow.py
                 Deep Click    a[title="New"]       (the browser is taken from SeleniumLibrary)

Generated by selenium-ai-agent.
"""
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.actions.action_builder import ActionBuilder
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait

__all__ = ['deep_click', 'deep_right_click', 'deep_type', 'deep_select', 'deep_text', 'deep_value',
           'deep_wait_visible', 'deep_count']

_LIB = r'''${PAGE_LIB}'''


def _driver(driver):
    if driver is not None:
        return driver
    from robot.libraries.BuiltIn import BuiltIn  # Robot Framework: use SeleniumLibrary's browser
    return BuiltIn().get_library_instance('SeleniumLibrary').driver


def _run(driver, call, *args):
    return driver.execute_script(_LIB + 'return ' + call + ';', *args)


def _point(driver, path, timeout):
    def ready(d):
        p = _run(d, 'point(arguments[0])', path)
        return p if p and p['hit'] else False
    return WebDriverWait(driver, float(timeout)).until(ready, 'No visible, uncovered element matches ' + path)


def _state(driver, path, timeout):
    def visible(d):
        s = _run(d, 'state(arguments[0])', path)
        return s if s and s['visible'] else False
    return WebDriverWait(driver, float(timeout)).until(visible, 'No visible element matches ' + path)


def _click_at(driver, p, right=False):
    actions = ActionBuilder(driver)
    actions.pointer_action.move_to_location(p['x'], p['y'])
    if right:
        actions.pointer_action.context_click()
    else:
        actions.pointer_action.click()
    actions.perform()


def deep_click(path, driver=None, timeout=10):
    """Click the element with a real mouse click at its centre."""
    driver = _driver(driver)
    _click_at(driver, _point(driver, path, timeout))


def deep_right_click(path, driver=None, timeout=10):
    """Right-click the element at its centre."""
    driver = _driver(driver)
    _click_at(driver, _point(driver, path, timeout), right=True)


def deep_type(path, text, driver=None, clear=True, timeout=10):
    """Click into the field and type with real key events; by default replaces what is in it."""
    driver = _driver(driver)
    _click_at(driver, _point(driver, path, timeout))
    if clear and str(clear).lower() != 'false' and _run(driver, 'selectContent(arguments[0])', path) > 0:
        ActionChains(driver).send_keys(Keys.BACKSPACE).perform()
    if text:
        ActionChains(driver).send_keys(text).perform()


def deep_select(path, option, driver=None, timeout=10):
    """Open a dropdown list (e.g. a Lightning picklist) and click the option with this text or value."""
    driver = _driver(driver)
    _click_at(driver, _point(driver, path, timeout))
    seen = []

    def shown(d):
        p = _run(d, 'optionPoint(arguments[0])', option)
        if p['options']:
            seen[:] = p['options']
        return p if p['found'] and p['hit'] else False
    try:
        p = WebDriverWait(driver, float(timeout)).until(shown)
    except TimeoutException:
        raise AssertionError('No option "%s" in the list of %s. Options shown: %s' % (option, path, ', '.join(seen)))
    _click_at(driver, p)


def deep_text(path, driver=None, timeout=10):
    """The element's visible text, once it is visible."""
    return _state(_driver(driver), path, timeout)['text']


def deep_value(path, driver=None, timeout=10):
    """A field's value (or the text of a picklist button), once it is visible."""
    s = _state(_driver(driver), path, timeout)
    return s['value'] or s['text']


def deep_wait_visible(path, driver=None, timeout=10):
    """Wait until the element is visible."""
    _state(_driver(driver), path, timeout)


def deep_count(path, driver=None):
    """How many elements match (visible or not)."""
    return _run(_driver(driver), 'queryAllPath(arguments[0]).length', path)
`;
}

function javascriptHelper(): string {
  return `// ${HEADER}
//
// ${WHY}
//
// Usage: import { deepClick, deepType, deepSelect, deepText } from './deep-shadow.js';
//        await deepClick(driver, 'a[title="New"]');
// Generated by selenium-ai-agent.
import { Key, Origin } from 'selenium-webdriver';

const LIB = ${JSON.stringify(PAGE_LIB)};

const run = (driver, call, ...args) => driver.executeScript(LIB + 'return ' + call + ';', ...args);

function point(driver, path, timeout) {
  return driver.wait(async () => {
    const p = await run(driver, 'point(arguments[0])', path);
    return p && p.hit ? p : null;
  }, timeout, 'No visible, uncovered element matches ' + path);
}

function state(driver, path, timeout) {
  return driver.wait(async () => {
    const s = await run(driver, 'state(arguments[0])', path);
    return s && s.visible ? s : null;
  }, timeout, 'No visible element matches ' + path);
}

function clickAt(driver, p, right = false) {
  const chain = driver.actions({ async: true }).move({ x: p.x, y: p.y, origin: Origin.VIEWPORT });
  return (right ? chain.contextClick() : chain.click()).perform();
}

/** Click the element with a real mouse click at its centre. */
export async function deepClick(driver, path, timeout = 10000) {
  await clickAt(driver, await point(driver, path, timeout));
}

/** Right-click the element at its centre. */
export async function deepRightClick(driver, path, timeout = 10000) {
  await clickAt(driver, await point(driver, path, timeout), true);
}

/** Click into the field and type with real key events; by default replaces what is in it. */
export async function deepType(driver, path, text, clear = true, timeout = 10000) {
  await clickAt(driver, await point(driver, path, timeout));
  if (clear && (await run(driver, 'selectContent(arguments[0])', path)) > 0) {
    await driver.actions({ async: true }).sendKeys(Key.BACK_SPACE).perform();
  }
  if (text) await driver.actions({ async: true }).sendKeys(text).perform();
}

/** Open a dropdown list (e.g. a Lightning picklist) and click the option with this text or value. */
export async function deepSelect(driver, path, option, timeout = 10000) {
  await clickAt(driver, await point(driver, path, timeout));
  let seen = [];
  let p;
  try {
    p = await driver.wait(async () => {
      const o = await run(driver, 'optionPoint(arguments[0])', option);
      if (o.options.length) seen = o.options;
      return o.found && o.hit ? o : null;
    }, timeout);
  } catch {
    throw new Error('No option "' + option + '" in the list of ' + path + '. Options shown: ' + seen.join(', '));
  }
  await clickAt(driver, p);
}

/** The element's visible text, once it is visible. */
export async function deepText(driver, path, timeout = 10000) {
  return (await state(driver, path, timeout)).text;
}

/** A field's value (or the text of a picklist button), once it is visible. */
export async function deepValue(driver, path, timeout = 10000) {
  const s = await state(driver, path, timeout);
  return s.value || s.text;
}

/** Wait until the element is visible. */
export async function deepWaitVisible(driver, path, timeout = 10000) {
  await state(driver, path, timeout);
}

/** How many elements match (visible or not). */
export function deepCount(driver, path) {
  return run(driver, 'queryAllPath(arguments[0]).length', path);
}
`;
}

function javaHelper(): string {
  // Java text block: backslashes must be escaped; indentation is stripped up to the closing quotes.
  const lib = PAGE_LIB.replace(/\\/g, '\\\\').split('\n').map(l => (l ? '      ' + l : l)).join('\n');
  return `import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.Keys;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;

/**
 * ${HEADER}
 *
 * <p>${WHY}
 *
 * <p>Usage: {@code DeepShadow.click(driver, "a[title=\\"New\\"]");} Needs Java 15+ and Selenium 4.2+.
 * Generated by selenium-ai-agent.
 */
public final class DeepShadow {
  private static final Duration TIMEOUT = Duration.ofSeconds(10);
  private static final String LIB = """
${lib}
      """;

  private DeepShadow() {}

  private static Object run(WebDriver driver, String call, Object... args) {
    return ((JavascriptExecutor) driver).executeScript(LIB + "return " + call + ";", args);
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> point(WebDriver driver, String path) {
    return new WebDriverWait(driver, TIMEOUT).withMessage("No visible, uncovered element matches " + path).until(d -> {
      Map<String, Object> p = (Map<String, Object>) run(d, "point(arguments[0])", path);
      return p != null && Boolean.TRUE.equals(p.get("hit")) ? p : null;
    });
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> state(WebDriver driver, String path) {
    return new WebDriverWait(driver, TIMEOUT).withMessage("No visible element matches " + path).until(d -> {
      Map<String, Object> s = (Map<String, Object>) run(d, "state(arguments[0])", path);
      return s != null && Boolean.TRUE.equals(s.get("visible")) ? s : null;
    });
  }

  private static void clickAt(WebDriver driver, Map<String, Object> p, boolean right) {
    Actions actions = new Actions(driver).moveToLocation(((Number) p.get("x")).intValue(), ((Number) p.get("y")).intValue());
    (right ? actions.contextClick() : actions.click()).perform();
  }

  /** Click the element with a real mouse click at its centre. */
  public static void click(WebDriver driver, String path) {
    clickAt(driver, point(driver, path), false);
  }

  /** Right-click the element at its centre. */
  public static void rightClick(WebDriver driver, String path) {
    clickAt(driver, point(driver, path), true);
  }

  /** Click into the field and type with real key events, replacing what is in it. */
  public static void type(WebDriver driver, String path, String text) {
    clickAt(driver, point(driver, path), false);
    if (((Number) run(driver, "selectContent(arguments[0])", path)).intValue() > 0) {
      new Actions(driver).sendKeys(Keys.BACK_SPACE).perform();
    }
    if (text != null && !text.isEmpty()) new Actions(driver).sendKeys(text).perform();
  }

  /** Open a dropdown list (e.g. a Lightning picklist) and click the option with this text or value. */
  @SuppressWarnings("unchecked")
  public static void select(WebDriver driver, String path, String option) {
    clickAt(driver, point(driver, path), false);
    List<Object> seen = new ArrayList<>();
    Map<String, Object> p;
    try {
      p = new WebDriverWait(driver, TIMEOUT).until(d -> {
        Map<String, Object> o = (Map<String, Object>) run(d, "optionPoint(arguments[0])", option);
        List<Object> shown = (List<Object>) o.get("options");
        if (!shown.isEmpty()) { seen.clear(); seen.addAll(shown); }
        return Boolean.TRUE.equals(o.get("found")) && Boolean.TRUE.equals(o.get("hit")) ? o : null;
      });
    } catch (TimeoutException e) {
      throw new AssertionError("No option \\"" + option + "\\" in the list of " + path + ". Options shown: " + seen);
    }
    clickAt(driver, p, false);
  }

  /** The element's visible text, once it is visible. */
  public static String text(WebDriver driver, String path) {
    return (String) state(driver, path).get("text");
  }

  /** A field's value (or the text of a picklist button), once it is visible. */
  public static String value(WebDriver driver, String path) {
    Map<String, Object> s = state(driver, path);
    Object value = s.get("value");
    return value != null && !value.toString().isEmpty() ? value.toString() : (String) s.get("text");
  }

  /** Wait until the element is visible. */
  public static void waitVisible(WebDriver driver, String path) {
    state(driver, path);
  }

  /** How many elements match (visible or not). */
  public static long count(WebDriver driver, String path) {
    return ((Number) run(driver, "queryAllPath(arguments[0]).length", path)).longValue();
  }
}
`;
}

/** The helper file for a language. */
export function shadowHelper(language: HelperLanguage): ShadowHelper {
  switch (language) {
    case 'java':
      return {
        language, filename: 'DeepShadow.java', code: javaHelper(),
        usage: 'Save as DeepShadow.java next to the tests (add the package line of that folder), then DeepShadow.click(driver, path).',
      };
    case 'javascript':
      return {
        language, filename: 'deep-shadow.js', code: javascriptHelper(),
        usage: "Save as deep-shadow.js next to the tests, then import { deepClick, deepType, deepSelect, deepText } from './deep-shadow.js'.",
      };
    default:
      return {
        language, filename: 'deep_shadow.py', code: pythonHelper(),
        usage: 'Save as deep_shadow.py next to the tests. pytest: from deep_shadow import deep_click, deep_type, deep_select, deep_text. ' +
          'Robot Framework: Library    deep_shadow.py   (keywords Deep Click, Deep Type, Deep Select, Deep Text, Deep Value, Deep Wait Visible, Deep Count).',
      };
  }
}
