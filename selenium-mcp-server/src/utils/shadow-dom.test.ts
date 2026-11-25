import { describe, it } from 'mocha';
import { expect } from 'chai';
import type { WebDriver, WebElement } from 'selenium-webdriver';
import {
  shadowSnippets, clickDeep, typeDeep, isUsableElement, DEEP_QUERY, clickOptionDeep, stateDeep, dragDeep, selectNativeDeep,
} from './shadow-dom.js';
import { locatorSnippets, type LocatorCandidate } from './locator-match.js';
import { resolveRefTarget } from './element-discovery/element-scripts.js';
import type { ElementInfo } from '../types.js';

/** A WebElement whose every command fails as stale, like elements behind LWC synthetic shadow DOM. */
const staleElement = { getTagName: async () => { throw new Error('stale element reference'); } } as unknown as WebElement;
const liveElement = { getTagName: async () => 'button' } as unknown as WebElement;

/** Fake driver: answers the in-page scripts by recognising them, and records Actions. */
function fakeDriver(opts: {
  found?: WebElement | null; count?: number; point?: object | null; selected?: number;
  options?: object[]; state?: object | null; native?: object; elementPoint?: object;
}) {
  const performed: string[] = [];
  let optionCalls = 0;
  const actions = () => {
    const chain = {
      move: (o: { x: number; y: number }) => { performed.push(`move ${o.x},${o.y}`); return chain; },
      click: () => { performed.push('click'); return chain; },
      contextClick: () => { performed.push('contextClick'); return chain; },
      press: () => { performed.push('press'); return chain; },
      release: () => { performed.push('release'); return chain; },
      sendKeys: (...keys: string[]) => { performed.push(`keys ${keys.join('')}`); return chain; },
      perform: async () => undefined,
    };
    return chain;
  };
  const driver = {
    executeScript: async (script: string) => {
      if (script.includes('[role="option"]')) {                                              // OPTION_POINT
        const list = opts.options ?? [];
        return list[Math.min(optionCalls++, list.length - 1)];
      }
      if (script.includes('var info = arguments[0]')) return opts.found ?? null;           // FIND_ELEMENT_SCRIPT
      if (script.startsWith('var el = arguments[0];')) return opts.elementPoint;           // ELEMENT_POINT
      if (script.includes('getComputedStyle(el)')) return opts.state ?? null;              // STATE
      if (script.includes('el.selectedIndex = i')) return opts.native;                     // SELECT_NATIVE
      if (script.includes('queryAllPath(arguments[0]).length')) return opts.count ?? 0; // COUNT
      if (script.includes('elementFromPoint')) return opts.point ?? null;               // POINT
      if (script.includes('el.select()')) return opts.selected ?? 0;                    // SELECT_CONTENT
      throw new Error('unexpected script');
    },
    actions,
    // Like driver.wait with a function condition: polls a few times, then times out.
    wait: async (condition: () => Promise<unknown>) => {
      for (let i = 0; i < 3; i++) { const v = await condition(); if (v) return v; }
      throw new Error('Wait timed out');
    },
  } as unknown as WebDriver;
  return { driver, performed };
}

const saveButton: ElementInfo = {
  ref: 'e78', tagName: 'button', role: 'button', text: 'Save', isClickable: true, isVisible: true,
  attributes: { name: 'SaveEdit' }, css: 'button[name="SaveEdit"]',
};

const base: LocatorCandidate = {
  tag: 'button', role: '', type: '', text: 'Sign in', label: '', placeholder: '', name: '', id: '',
  testId: '', context: '', css: '', xpath: '',
};

describe('shadow DOM locators', () => {
  it('opens every shadow root in turn, in Python, Java and JavaScript', () => {
    const s = shadowSnippets('login-form >>> app-button >>> button');
    expect(s.python).to.equal(
      "driver.find_element(By.CSS_SELECTOR, 'login-form').shadow_root.find_element(By.CSS_SELECTOR, 'app-button')" +
      ".shadow_root.find_element(By.CSS_SELECTOR, 'button')");
    expect(s.java).to.equal(
      'driver.findElement(By.cssSelector("login-form")).getShadowRoot().findElement(By.cssSelector("app-button"))' +
      '.getShadowRoot().findElement(By.cssSelector("button"))');
    expect(s.javascript).to.equal(
      "await (await (await (await (await driver.findElement(By.css('login-form'))).getShadowRoot())" +
      ".findElement(By.css('app-button'))).getShadowRoot()).findElement(By.css('button'))");
  });

  it('quotes selectors correctly', () => {
    const s = shadowSnippets('login-form >>> [data-testid="pw"]');
    expect(s.python).to.contain(`'[data-testid="pw"]'`);
    expect(s.java).to.contain('By.cssSelector("[data-testid=\\"pw\\"]")');
  });

  it('gives shadow DOM code instead of a plain locator (and no XPath) for elements in a web component', () => {
    const snippets = locatorSnippets({ ...base, css: 'login-form >>> #u' });
    expect(snippets.recommended).to.equal('login-form >>> #u');
    expect(snippets.python).to.contain('.shadow_root.find_element');
    expect(snippets).to.not.have.property('xpath');
  });

  it('keeps plain locators for elements in the page itself', () => {
    expect(locatorSnippets({ ...base, css: '#login' }).python).to.equal("(By.CSS_SELECTOR, '#login')");
  });
});

describe('shadow DOM: what counts as shown', () => {
  const isShown = new Function('window', `${DEEP_QUERY}\nreturn isShown;`)({ scrollX: 0, scrollY: 0 });
  const el = (rect: object, boxes = 1) => ({ getClientRects: () => new Array(boxes), getBoundingClientRect: () => rect });

  it('skips copies Salesforce parks off the page (left of it)', () => {
    expect(isShown(el({ width: 300, height: 32, right: -9138, bottom: 60 }))).to.equal(false);
  });
  it('keeps elements on the page, also below the fold', () => {
    expect(isShown(el({ width: 300, height: 32, right: 600, bottom: 300 }))).to.equal(true);
    expect(isShown(el({ width: 300, height: 32, right: 600, bottom: 4000 }))).to.equal(true);
  });
  it('skips elements without a box', () => {
    expect(isShown(el({ width: 0, height: 0, right: 0, bottom: 0 }, 0))).to.equal(false);
  });
});

describe('shadow DOM: deep query', () => {
  it('searches an element\'s own shadow root and its light-DOM children for the next part of a >>> path', () => {
    expect(DEEP_QUERY).to.contain('if (root.shadowRoot) visit(root.shadowRoot);');
    expect(DEEP_QUERY).to.contain('roots = found;');
  });
});

describe('shadow DOM: resolving a ref', () => {
  it('returns the WebElement when WebDriver can use it (normal pages are unchanged)', async () => {
    const { driver } = fakeDriver({ found: liveElement, count: 1 });
    const target = await resolveRefTarget(driver, saveButton);
    expect(target.element).to.equal(liveElement);
    expect(target.selector).to.equal(undefined);
  });

  it('falls back to the selector when the element comes back stale (LWC synthetic shadow)', async () => {
    const { driver } = fakeDriver({ found: staleElement, count: 1 });
    expect(await resolveRefTarget(driver, saveButton)).to.deep.equal({ selector: 'button[name="SaveEdit"]' });
  });

  it('falls back to the selector when the element is not returned at all', async () => {
    const { driver } = fakeDriver({ found: null, count: 1 });
    expect(await resolveRefTarget(driver, saveButton)).to.deep.equal({ selector: 'button[name="SaveEdit"]' });
  });

  it('reports the ref when nothing matches anywhere', async () => {
    const { driver } = fakeDriver({ found: null, count: 0 });
    let message = '';
    try { await resolveRefTarget(driver, saveButton); } catch (e) { message = (e as Error).message; }
    expect(message).to.equal('Could not find element: e78 (button)');
  });

  it('tells usable and stale elements apart', async () => {
    expect(await isUsableElement(liveElement)).to.equal(true);
    expect(await isUsableElement(staleElement)).to.equal(false);
  });
});

describe('shadow DOM: real input at the element position', () => {
  it('clicks with a real mouse event at the element centre', async () => {
    const { driver, performed } = fakeDriver({ point: { x: 603, y: 295, hit: true, tag: 'button' } });
    await clickDeep(driver, 'button[name="SaveEdit"]');
    expect(performed).to.deep.equal(['move 603,295', 'click']);
  });

  it('refuses to click when another element covers the target', async () => {
    const { driver, performed } = fakeDriver({ point: { x: 10, y: 20, hit: false, tag: 'button' } });
    let message = '';
    try { await clickDeep(driver, 'button'); } catch (e) { message = (e as Error).message; }
    expect(message).to.contain('is covered by another element at (10, 20)');
    expect(performed).to.deep.equal([]);
  });

  it('says so when no visible element matches', async () => {
    const { driver } = fakeDriver({ point: null });
    let message = '';
    try { await clickDeep(driver, '#nope'); } catch (e) { message = (e as Error).message; }
    expect(message).to.equal('No visible element matches #nope');
  });

  it('clears existing text with real keys before typing', async () => {
    const { driver, performed } = fakeDriver({ point: { x: 5, y: 6, hit: true, tag: 'input' }, selected: 4 });
    await typeDeep(driver, 'input', 'Acme', true);
    expect(performed).to.deep.equal(['move 5,6', 'click', 'keys ', 'keys Acme']);
  });

  it('does not press backspace on an empty field', async () => {
    const { driver, performed } = fakeDriver({ point: { x: 5, y: 6, hit: true, tag: 'input' }, selected: 0 });
    await typeDeep(driver, 'input', 'Acme', true);
    expect(performed).to.deep.equal(['move 5,6', 'click', 'keys Acme']);
  });

  it('right-clicks with a real context click', async () => {
    const { driver, performed } = fakeDriver({ point: { x: 1, y: 2, hit: true, tag: 'a' } });
    await clickDeep(driver, 'a', 'right');
    expect(performed).to.deep.equal(['move 1,2', 'contextClick']);
  });

  it('drags with press, moves in steps and release', async () => {
    const { driver, performed } = fakeDriver({ point: { x: 100, y: 100, hit: true, tag: 'div' }, elementPoint: { x: 300, y: 200, hit: true, tag: 'div' } });
    await dragDeep(driver, { selector: '.card' }, { element: liveElement });
    expect(performed).to.deep.equal(['move 100,100', 'press', 'move 200,150', 'move 300,200', 'release']);
  });

  it('releases the mouse button when finding the drop target fails', async () => {
    // elementPoint is not set, so measuring the drop target fails after the button is pressed.
    const { driver, performed } = fakeDriver({ point: { x: 100, y: 100, hit: true, tag: 'div' } });
    let failed = false;
    try { await dragDeep(driver, { selector: '.card' }, { element: liveElement }); } catch { failed = true; }
    expect(failed).to.equal(true);
    expect(performed).to.deep.equal(['move 100,100', 'press', 'release']);
  });
});

describe('shadow DOM: dropdown lists (Lightning picklists, comboboxes)', () => {
  it('waits for the option to appear, then clicks it', async () => {
    const { driver, performed } = fakeDriver({ options: [
      { found: false, options: [] },
      { found: true, x: 40, y: 50, hit: true, label: 'Hot', options: [] },
    ] });
    expect(await clickOptionDeep(driver, { text: 'Hot' })).to.equal('Hot');
    expect(performed).to.deep.equal(['move 40,50', 'click']);
  });

  it('lists the options it saw when the wanted one is not there', async () => {
    const { driver, performed } = fakeDriver({ options: [{ found: false, options: ['--None--', 'Hot', 'Warm', 'Cold'] }] });
    let message = '';
    try { await clickOptionDeep(driver, { text: 'Boiling' }); } catch (e) { message = (e as Error).message; }
    expect(message).to.equal('No option "Boiling" in the list. Options shown: --None--, Hot, Warm, Cold');
    expect(performed).to.deep.equal([]);
  });

  it('says when no dropdown opened at all', async () => {
    const { driver } = fakeDriver({ options: [{ found: false, options: [] }] });
    let message = '';
    try { await clickOptionDeep(driver, { index: 2 }); } catch (e) { message = (e as Error).message; }
    expect(message).to.equal('No dropdown options appeared (looked for "#2")');
  });

  it('does not click an option that is covered', async () => {
    const { driver, performed } = fakeDriver({ options: [{ found: true, x: 1, y: 1, hit: false, label: 'Hot', options: [] }] });
    let message = '';
    try { await clickOptionDeep(driver, { text: 'Hot' }); } catch (e) { message = (e as Error).message; }
    expect(message).to.contain('is covered by another element');
    expect(performed).to.deep.equal([]);
  });

});

describe('shadow DOM: reading state and native selects', () => {
  it('reads the value, text and visibility in the page', async () => {
    const state = { tag: 'input', value: 'Acme', text: '', visible: true, rect: { x: 1, y: 2, width: 3, height: 4 } };
    const { driver } = fakeDriver({ state });
    expect(await stateDeep(driver, 'input')).to.deep.equal(state);
  });

  it('returns null when nothing matches', async () => {
    const { driver } = fakeDriver({ state: null });
    expect(await stateDeep(driver, '#nope')).to.equal(null);
  });

  it('passes the result of setting a native select through', async () => {
    const { driver } = fakeDriver({ native: { label: 'Prospect' } });
    expect(await selectNativeDeep(driver, 'select', { text: 'Prospect' })).to.deep.equal({ label: 'Prospect' });
  });
});
