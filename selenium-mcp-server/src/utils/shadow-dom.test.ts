import { describe, it } from 'mocha';
import { expect } from 'chai';
import { shadowSnippets } from './shadow-dom.js';
import { locatorSnippets, type LocatorCandidate } from './locator-match.js';

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
