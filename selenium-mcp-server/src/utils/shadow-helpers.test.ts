import { describe, it } from 'mocha';
import { expect } from 'chai';
import { PAGE_LIB, deepCallSnippets, helperLanguageFor, shadowHelper } from './shadow-helpers.js';
import { locatorSnippets, rankCandidates, type LocatorCandidate } from './locator-match.js';

const base: LocatorCandidate = {
  tag: 'a', role: 'button', type: '', text: 'New', label: '', placeholder: '', name: '', id: '',
  testId: '', context: '', css: '', xpath: '',
};

describe('script generator: shadow DOM locators', () => {
  it('gives helper calls, not find_element or shadow_root, for Salesforce-style (synthetic) shadow DOM', () => {
    const s = locatorSnippets({ ...base, css: 'one-app-nav-bar >>> a[title="New"]', syntheticShadow: true });
    expect(s.python).to.match(/^deep_click\('one-app-nav-bar >>> a\[title="New"\]', driver\)/);
    expect(s.robot).to.match(/^Deep Click {4}one-app-nav-bar >>> a\[title="New"\]/);
    expect(s.javascript).to.match(/^await deepClick\(driver, 'one-app-nav-bar >>> a\[title="New"\]'\)/);
    expect(s.java).to.match(/^DeepShadow\.click\(driver, "one-app-nav-bar >>> a\[title=\\"New\\"\]"\);/);
    expect(s.csharp).to.match(/^DeepShadow\.Click\(driver, "one-app-nav-bar >>> a\[title=\\"New\\"\]"\);/);
    for (const code of Object.values(s)) expect(code).not.to.match(/shadow_root|getShadowRoot|GetShadowRoot|find_element|findElement|FindElement/);
  });

  it('also calls the helper for synthetic shadow elements whose selector has no >>> path', () => {
    expect(locatorSnippets({ ...base, css: 'button[name="SaveEdit"]', syntheticShadow: true }).python)
      .to.match(/^deep_click\('button\[name="SaveEdit"\]', driver\)/);
  });

  it('keeps shadow_root code for real shadow DOM, with the helper for Robot Framework', () => {
    const s = locatorSnippets({ ...base, css: 'login-form >>> #user' });
    expect(s.python).to.equal("driver.find_element(By.CSS_SELECTOR, 'login-form').shadow_root.find_element(By.CSS_SELECTOR, '#user')");
    expect(s.robot).to.match(/^Deep Click {4}login-form >>> #user/);
    expect(s.csharp).to.equal('driver.FindElement(By.CssSelector("login-form")).GetShadowRoot().FindElement(By.CssSelector("#user"))');
  });

  it('gives C# locators for elements in the page itself', () => {
    expect(locatorSnippets({ ...base, css: '#login' }).csharp).to.equal('By.CssSelector("#login")');
    expect(locatorSnippets({ ...base, css: '#login', xpath: "//a[normalize-space()='New']" }).csharpXpath)
      .to.equal('By.XPath("//a[normalize-space()=\'New\']")');
  });

  it('gives SeleniumLibrary locators for elements in the page itself', () => {
    expect(locatorSnippets({ ...base, css: '#login' }).robot).to.equal('css:#login');
    expect(locatorSnippets({ ...base, css: 'body > div:nth-of-type(2) > a:nth-of-type(1)', xpath: "//a[normalize-space()='New']" }).robot)
      .to.equal("xpath://a[normalize-space()='New']");
  });

  it('quotes selectors for each language', () => {
    const s = deepCallSnippets("a[title='It\\'s']");
    expect(s.python).to.contain("deep_click('a[title=\\'It\\\\\\'s\\']', driver)");
    expect(s.java).to.contain('DeepShadow.click(driver, "a[title=\'It\\\\\'s\']");');
  });
});

describe('script generator: picking the element that was meant', () => {
  it('prefers the field in the open dialog over a list column behind it', () => {
    const header = { ...base, tag: 'button', text: 'Account Name', css: 'th button', covered: true };
    const field = { ...base, tag: 'input', text: '', label: 'Account Name', css: 'input[name="Name"]', covered: false };
    expect(rankCandidates('Account Name', [header, field])[0].css).to.equal('input[name="Name"]');
  });

  it('prefers an exact text match: "Cancel" over "Cancel and close"', () => {
    const close = { ...base, tag: 'button', text: 'Cancel and close', css: 'button.close' };
    const cancel = { ...base, tag: 'button', text: 'Cancel', css: 'button[name="CancelEdit"]' };
    expect(rankCandidates('Cancel button', [close, cancel])[0].css).to.equal('button[name="CancelEdit"]');
  });
});

describe('script generator: helper file per framework', () => {
  it('picks the helper language from the framework', () => {
    expect(helperLanguageFor('robot-framework')).to.equal('python');
    expect(helperLanguageFor('selenium-python-pytest')).to.equal('python');
    expect(helperLanguageFor(undefined)).to.equal('python');
    expect(helperLanguageFor('selenium-java-maven')).to.equal('java');
    expect(helperLanguageFor('selenium-js-mocha')).to.equal('javascript');
    expect(helperLanguageFor('selenium-js-jest')).to.equal('javascript');
    expect(helperLanguageFor('playwright-js')).to.equal(null);
    expect(helperLanguageFor('webdriverio-ts')).to.equal(null);
    expect(helperLanguageFor('selenium-csharp-nunit')).to.equal('csharp');
    expect(helperLanguageFor('selenium-dotnet-xunit')).to.equal('csharp');
    expect(helperLanguageFor('mstest')).to.equal('csharp');
    expect(helperLanguageFor('selenium-java-testng')).to.equal('java');
  });

  it('runs valid JavaScript in the page', () => {
    expect(() => new Function(`${PAGE_LIB}\nreturn point;`)).not.to.throw();
  });

  it('Python helper (pytest and Robot): exposes only its keywords and embeds the page code unchanged', () => {
    const h = shadowHelper('python');
    expect(h.filename).to.equal('deep_shadow.py');
    expect(h.code).to.contain("__all__ = ['deep_click', 'deep_right_click', 'deep_type', 'deep_select'");
    expect(h.code).to.contain(`_LIB = r'''${PAGE_LIB}'''`);
    expect(PAGE_LIB).not.to.contain("'''");
    expect(h.code).to.contain("BuiltIn().get_library_instance('SeleniumLibrary').driver");
    expect(h.code).not.to.match(/time\.sleep|implicitly_wait/);
  });

  it('JavaScript helper parses', () => {
    const h = shadowHelper('javascript');
    const body = h.code.replace(/^import .*$/m, '').replace(/^export /gm, '');
    expect(() => new Function('Key', 'Origin', body)).not.to.throw();
  });

  it('Java helper escapes the page code for a text block', () => {
    const h = shadowHelper('java');
    expect(h.filename).to.equal('DeepShadow.java');
    expect(h.code).to.contain('public final class DeepShadow');
    expect(h.code).to.contain('.replace(/\\\\s+/g');   // \s in the page code becomes \\s in Java source
    expect(h.code).not.to.contain('Thread.sleep');
  });

  it('C# helper keeps the page code intact in a verbatim string', () => {
    const h = shadowHelper('csharp');
    expect(h.filename).to.equal('DeepShadow.cs');
    expect(h.code).to.contain('public static class DeepShadow');
    const lib = /private const string Lib = @"([\s\S]*?)";\n/.exec(h.code);
    expect(lib, 'Lib string').to.not.equal(null);
    expect(lib![1].replace(/""/g, '"')).to.equal(PAGE_LIB);   // C# verbatim: "" is one quote, backslashes kept
    expect(h.code).not.to.match(/Thread\.Sleep|Task\.Delay|ImplicitWait/);
    // An instant (0 ms) move left Lightning picklist options unselected; Java and Python move over 250 ms.
    expect(h.code).to.contain('TimeSpan.FromMilliseconds(250)');
    expect(h.code).to.contain('new PointerInputDevice(PointerKind.Mouse');
  });
});
