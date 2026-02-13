import { WebDriver } from 'selenium-webdriver';
import type { SelectorValidationResult } from '../types/manifest.js';

/**
 * Extract selectors from test code using regex patterns for common frameworks.
 * Returns an array of { selector, framework } objects.
 */
export function extractSelectors(testCode: string): Array<{ selector: string; framework: string }> {
  const results: Array<{ selector: string; framework: string }> = [];
  const seen = new Set<string>();

  const patterns: Array<{ regex: RegExp; framework: string; group: number }> = [
    // Selenium: By.id("x"), By.css("x"), By.xpath("x"), By.name("x"), By.className("x")
    { regex: /By\.(id|css|xpath|name|className|tagName|linkText|partialLinkText)\(\s*['"`]([^'"`]+)['"`]\s*\)/g, framework: 'selenium', group: 2 },
    // Playwright: locator("x"), page.locator("x")
    { regex: /\.locator\(\s*['"`]([^'"`]+)['"`]\s*\)/g, framework: 'playwright', group: 1 },
    // Playwright: getByRole, getByText, getByLabel, getByPlaceholder, getByTestId
    { regex: /\.getBy(Role|Text|Label|Placeholder|TestId)\(\s*['"`]([^'"`]+)['"`]/g, framework: 'playwright', group: 2 },
    // jQuery / WebdriverIO: $("x"), $$("x")
    { regex: /\$\$?\(\s*['"`]([^'"`]+)['"`]\s*\)/g, framework: 'wdio', group: 1 },
    // CSS selectors in generic querySelector
    { regex: /querySelector(?:All)?\(\s*['"`]([^'"`]+)['"`]\s*\)/g, framework: 'css', group: 1 },
    // Robot Framework: id=x, css=x, xpath=x
    { regex: /(?:id|css|xpath|name|class)=([^\s\]]+)/g, framework: 'robot', group: 1 },
  ];

  for (const { regex, framework, group } of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(testCode)) !== null) {
      const selector = match[group];
      if (selector && !seen.has(selector)) {
        seen.add(selector);
        results.push({ selector, framework });
      }
    }
  }

  return results;
}

/**
 * Validate selectors against the live page using a single executeScript call.
 * Returns per-selector validation results.
 */
export async function validateSelectorsLive(
  driver: WebDriver,
  selectors: Array<{ selector: string; framework: string }>
): Promise<SelectorValidationResult[]> {
  if (selectors.length === 0) return [];

  // Build CSS-compatible selectors for batch validation
  const cssSelectors = selectors.map(s => {
    // Skip xpath selectors — can't validate via querySelectorAll
    if (s.selector.startsWith('/') || s.selector.startsWith('(')) {
      return null;
    }
    // Selenium By.id → #id
    if (s.framework === 'selenium' && !s.selector.includes(' ') && !s.selector.includes('.') && !s.selector.includes('#')) {
      return `#${s.selector}`;
    }
    return s.selector;
  });

  try {
    const results: SelectorValidationResult[] = [];

    // Validate in a single script call
    const validationScript = `
      const selectors = arguments[0];
      return selectors.map(sel => {
        if (sel === null) return { valid: false, matchCount: 0, error: 'xpath' };
        try {
          const elements = document.querySelectorAll(sel);
          return { valid: elements.length > 0, matchCount: elements.length };
        } catch (e) {
          return { valid: false, matchCount: 0, error: e.message };
        }
      });
    `;

    const scriptResults = await driver.executeScript(validationScript, cssSelectors) as Array<{ valid: boolean; matchCount: number; error?: string }>;

    for (let i = 0; i < selectors.length; i++) {
      const s = selectors[i];
      const r = scriptResults[i];

      let suggestion: string | undefined;
      if (!r.valid && r.error !== 'xpath') {
        suggestion = `Selector "${s.selector}" did not match any elements on the page`;
      }

      results.push({
        selector: s.selector,
        framework: s.framework,
        valid: r.valid,
        matchCount: r.matchCount,
        suggestion,
      });
    }

    return results;
  } catch {
    // If script fails entirely, return all as unknown
    return selectors.map(s => ({
      selector: s.selector,
      framework: s.framework,
      valid: false,
      matchCount: 0,
      suggestion: 'Could not validate (script execution failed)',
    }));
  }
}
