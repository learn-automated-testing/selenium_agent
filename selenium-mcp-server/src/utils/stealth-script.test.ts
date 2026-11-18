import { describe, it } from 'mocha';
import { expect } from 'chai';
import vm from 'node:vm';

import { STEALTH_PRELOAD_FUNCTION } from './chrome-options.js';

/** Run the preload script against a fake Navigator, like the browser would. */
function runPreload(webdriver: boolean | undefined) {
  class Navigator {
    get webdriver() { return webdriver; }
    get plugins() { return { length: 5, real: true }; }
  }
  const navigator = new Navigator();
  const sandbox = { navigator, window: {} as Record<string, unknown> };
  vm.runInNewContext(`(${STEALTH_PRELOAD_FUNCTION})()`, sandbox);
  return { navigator: navigator as any, window: sandbox.window, Navigator };
}

describe('stealth preload script', () => {
  it('makes navigator.webdriver read false (not undefined) when automation is visible', () => {
    const { navigator } = runPreload(true);
    expect(navigator.webdriver).to.equal(false);
  });

  it('patches the prototype, not the navigator instance', () => {
    const { navigator, Navigator } = runPreload(true);
    expect(Object.prototype.hasOwnProperty.call(navigator, 'webdriver')).to.equal(false);
    expect(Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver')?.get).to.be.a('function');
  });

  it('leaves a native false untouched', () => {
    const { Navigator } = runPreload(false);
    const getter = Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver')?.get;
    expect(getter?.toString()).to.contain('return webdriver');
  });

  it('no longer fakes plugins or chrome.runtime', () => {
    const { navigator, window } = runPreload(true);
    expect(navigator.plugins.real).to.equal(true);
    expect(window.chrome).to.equal(undefined);
  });
});
