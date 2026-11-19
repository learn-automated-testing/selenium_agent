import { describe, it } from 'mocha';
import { expect } from 'chai';
import { locatorSnippets, rankCandidates, type LocatorCandidate } from './locator-match.js';

const el = (over: Partial<LocatorCandidate>): LocatorCandidate => ({
  tag: 'button', role: '', type: '', text: '', label: '', placeholder: '', name: '', id: '', testId: '',
  context: '', css: '', xpath: '', ...over,
});

/** The practice web shop, as the in-page script reports it. */
const SHOP: LocatorCandidate[] = [
  el({ tag: 'input', type: 'text', placeholder: 'Search for items', testId: 'search-input', css: '[data-testid="search-input"]' }),
  el({ tag: 'select', label: 'Category', testId: 'category-filter', css: '[data-testid="category-filter"]' }),
  el({ text: 'Add to Cart', testId: 'add-to-cart-5', context: 'Bluetooth Headphones Accessories $59.99 Add to Cart', css: '[data-testid="add-to-cart-5"]' }),
  el({ text: 'Add to Cart', testId: 'add-to-cart-2', context: 'Mechanical Keyboard Electronics $89.99 Add to Cart', css: '[data-testid="add-to-cart-2"]' }),
  el({ text: '0 items $0.00', label: 'Open cart', testId: 'cart-button', css: '[data-testid="cart-button"]' }),
  el({ tag: 'a', text: 'Shopping', css: 'body > header:nth-of-type(1) > nav:nth-of-type(1) > a:nth-of-type(4)', xpath: "//a[normalize-space()='Shopping']" }),
];

const best = (d: string) => rankCandidates(d, SHOP)[0]?.css;

describe('browser_generate_locator matching', () => {
  it('finds a field by what it is called, not only by its exact text', () => {
    expect(best('search box')).to.equal('[data-testid="search-input"]');
    expect(best('category dropdown')).to.equal('[data-testid="category-filter"]');
  });

  it('uses the surrounding content to pick the right one of several equal buttons', () => {
    expect(best('the Add to Cart button of the Mechanical Keyboard')).to.equal('[data-testid="add-to-cart-2"]');
    expect(best('Add to Cart for the Bluetooth Headphones')).to.equal('[data-testid="add-to-cart-5"]');
  });

  it('prefers an element whose test id or label names the kind', () => {
    expect(best('cart button')).to.equal('[data-testid="cart-button"]');
  });

  it('returns nothing when nothing fits', () => {
    expect(rankCandidates('delete account', SHOP)).to.deep.equal([]);
  });

  it('writes locators that are valid code in each language, even with quotes in the value', () => {
    const s = locatorSnippets(el({ css: `[data-testid="it's"]` }));
    expect(s.javascript).to.equal(`By.css('[data-testid="it\\'s"]')`);
    expect(s.python).to.equal(`(By.CSS_SELECTOR, '[data-testid="it\\'s"]')`);
    expect(s.java).to.equal(`By.cssSelector("[data-testid=\\"it's\\"]")`);
  });

  it('recommends text-based XPath over a fragile positional path', () => {
    const link = SHOP[5];
    expect(locatorSnippets(link).recommended).to.equal("//a[normalize-space()='Shopping']");
    expect(locatorSnippets(SHOP[0]).recommended).to.equal('[data-testid="search-input"]');
  });
});
