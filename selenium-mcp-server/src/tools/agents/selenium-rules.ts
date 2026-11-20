/**
 * Selenium's official guidance for AI coding agents, used by the generator and the healer.
 *
 * Two sources, both from the Selenium project:
 * - https://www.selenium.dev/documentation/ai_agents/ — the "Using AI coding agents with Selenium"
 *   page: required modern patterns, patterns to avoid, and per-language notes. The checks below
 *   follow it rule by rule.
 * - rust/src/resources/rules.md in SeleniumHQ/selenium — "Selenium Rules for AI Assistants", with
 *   code per language binding. Bundled unchanged in selenium-rules.data.ts (Apache-2.0); the
 *   generator hands the agent the sections for the language it writes.
 *
 * WebdriverIO is not a Selenium binding, so it gets its own, smaller set from the WebdriverIO docs:
 * https://webdriver.io/docs/bestpractices and https://webdriver.io/docs/autowait.
 */
import { SELENIUM_RULES_MARKDOWN, SELENIUM_RULES_SOURCE } from './selenium-rules.data.js';

export { SELENIUM_RULES_SOURCE };

export const SELENIUM_AI_AGENTS_DOCS = 'https://www.selenium.dev/documentation/ai_agents/';
export const SELENIUM_LLMS_TXT = 'https://www.selenium.dev/llms.txt';
export const WEBDRIVERIO_BEST_PRACTICES = 'https://webdriver.io/docs/bestpractices';
export const WEBDRIVERIO_AUTOWAIT = 'https://webdriver.io/docs/autowait';

/** Whether a framework is WebdriverIO (its own rules, not Selenium's). */
export function isWebdriverIO(framework: string, filename = ''): boolean {
  const f = framework.toLowerCase();
  return f.startsWith('webdriverio') || f.startsWith('wdio') || /\bwdio\.conf\.[jt]s$/.test(filename);
}

/** A Selenium language binding, as rules.md names its subsections. */
export type SeleniumLanguage = 'Python' | 'Java' | 'JavaScript' | 'Ruby' | '.NET';

/**
 * The Selenium binding a framework (or, for a framework we don't know, a file) is written in.
 * Returns null for frameworks that don't use Selenium WebDriver (Playwright, WebdriverIO).
 */
export function seleniumLanguage(framework: string, filename = ''): SeleniumLanguage | null {
  const f = framework.toLowerCase();
  if (f.startsWith('playwright') || f.startsWith('webdriverio')) return null;
  if (f.includes('python') || f === 'pytest' || f.startsWith('robot')) return 'Python';
  if (f.includes('java') && !f.includes('javascript')) return 'Java';
  if (f.includes('kotlin')) return 'Java';
  if (f.includes('csharp') || f.includes('dotnet') || f.includes('c#')) return '.NET';
  if (f.includes('-js-') || f.includes('javascript') || f.includes('typescript') || f.endsWith('-js') || f.endsWith('-ts')) return 'JavaScript';
  if (f.includes('ruby')) return 'Ruby';
  const ext = filename.toLowerCase().split('.').pop() || '';
  const byExt: Record<string, SeleniumLanguage> = {
    py: 'Python', robot: 'Python', java: 'Java', kt: 'Java', cs: '.NET',
    js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', ts: 'JavaScript', rb: 'Ruby',
  };
  return byExt[ext] ?? null;
}

interface Section { title: string; body: string; subsections: { title: string; body: string }[] }

function parseSections(markdown: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  let sub: { title: string; body: string } | null = null;
  for (const line of markdown.split('\n')) {
    const h2 = /^## (.+)$/.exec(line);
    const h3 = /^### (.+)$/.exec(line);
    if (h2) {
      current = { title: h2[1].trim(), body: '', subsections: [] };
      sections.push(current);
      sub = null;
    } else if (h3 && current) {
      sub = { title: h3[1].trim(), body: '' };
      current.subsections.push(sub);
    } else if (current) {
      if (sub) sub.body += line + '\n';
      else current.body += line + '\n';
    }
  }
  return sections;
}

/** Sections that apply whatever the language. */
const GENERAL_SECTIONS = ['Core Principles', 'Common Expected Conditions', 'Common Errors & Fixes', 'Anti-Patterns to Avoid'];
/** Sections with one subsection per language; only the chosen language's is kept. */
const PER_LANGUAGE_SECTIONS = ['Starting a Browser', 'Always Quit the Driver', 'Locating Elements', 'Explicit Waits'];

/**
 * The parts of Selenium's official rules that apply to one language, as markdown for the agent.
 * Returns null for frameworks that don't use Selenium WebDriver.
 */
export function seleniumRulesFor(framework: string, filename = ''): string | null {
  if (isWebdriverIO(framework, filename)) return WEBDRIVERIO_RULES;
  const language = seleniumLanguage(framework, filename);
  if (!language) return null;
  const strip = (s: string) => s.replace(/\n---\s*\n?$/m, '').trim();
  const out: string[] = [
    `# Selenium's official rules for AI assistants (${language})`,
    '',
    `From the Selenium project: ${SELENIUM_RULES_SOURCE.url} (Apache-2.0). ` +
      `Full guide: ${SELENIUM_AI_AGENTS_DOCS} · current docs index: ${SELENIUM_LLMS_TXT}. ` +
      'An API that is not in the current docs or API reference does not exist: check before using it.',
  ];
  for (const section of parseSections(SELENIUM_RULES_MARKDOWN)) {
    const is = (names: string[]) => names.some(n => section.title === n || section.title.startsWith(n + ' '));
    if (is(GENERAL_SECTIONS)) {
      out.push('', `## ${section.title}`, '', strip(section.body));
    } else if (is(PER_LANGUAGE_SECTIONS)) {
      const match = section.subsections.find(s => s.title === language || s.title.startsWith(language + ' '));
      if (!match) continue;
      out.push('', `## ${section.title}`);
      const intro = strip(section.body);
      if (intro) out.push('', intro);
      out.push('', strip(match.body));
    }
  }
  if (framework.toLowerCase().startsWith('robot')) {
    out.push('', '## Robot Framework (SeleniumLibrary)', '',
      'The same rules apply to keywords: no `Sleep`; use `Wait Until ...` keywords. ' +
      'Keep `Set Selenium Implicit Wait` at 0 when using explicit waits, and close the browser in teardown.');
  }
  return out.join('\n') + '\n';
}

/** WebdriverIO guidance, summarised from its own docs (WebdriverIO is not part of the Selenium project). */
const WEBDRIVERIO_RULES = `# WebdriverIO rules for AI assistants

From the WebdriverIO docs: ${WEBDRIVERIO_BEST_PRACTICES} and ${WEBDRIVERIO_AUTOWAIT}.
These are WebdriverIO's own rules, not Selenium's.

## Waiting
- Never use \`browser.pause()\` to wait for the page: it is not resilient and makes tests flaky.
  Wait for the condition instead: \`waitForDisplayed\`, \`waitForExist\`, \`waitForEnabled\`, \`waitForClickable\`
  (\`{ reverse: true }\` to wait for the opposite), or \`browser.waitUntil()\` for anything else.
- Commands that act on an element (\`click\`, \`setValue\`, ...) already wait for it to be interactable.
- \`expect\` matchers from expect-webdriverio (\`toBeDisplayed\`, \`toHaveText\`, \`toHaveValue\`, ...) retry until
  \`waitforTimeout\`; don't add a \`waitFor...\` right before the same check.
- Don't set implicit timeouts (\`browser.setTimeout({ implicit })\`); set \`waitforTimeout\` in wdio.conf instead.

## Code
- Async only: \`await\` every command. The synchronous mode (\`@wdio/sync\`) and WebdriverIO v4 APIs
  (\`browser.element()\`, \`browser.elements()\`) no longer exist.
- Prefer ids and stable test attributes (\`[data-testid="..."]\`); avoid absolute XPath.
`;

// ============================================================================
// Rule check
// ============================================================================

export type RuleSeverity = 'error' | 'warning';

export interface RuleViolation {
  rule: string;
  severity: RuleSeverity;
  line: number;
  code: string;
  message: string;
}

interface Rule {
  id: string;
  severity: RuleSeverity;
  languages: SeleniumLanguage[] | 'all';
  patterns: RegExp[];
  message: string;
  /** For Robot Framework files the keyword patterns differ. */
  robotPatterns?: RegExp[];
}

interface WdioRule {
  id: string;
  severity: RuleSeverity;
  patterns: RegExp[];
  message: string;
}

/** WebdriverIO's own rules (https://webdriver.io/docs/bestpractices, https://webdriver.io/docs/autowait). */
const WDIO_RULES: WdioRule[] = [
  {
    id: 'wdio-no-pause', severity: 'error',
    patterns: [/\b(browser|driver)\.pause\s*\(/, /new Promise\(\s*\(?\s*\w+\s*\)?\s*=>\s*setTimeout\b/],
    message: 'Don\'t pause: wait for the condition with waitForDisplayed / waitForExist / waitForEnabled / waitForClickable, ' +
      'browser.waitUntil(), or a retrying expect matcher.',
  },
  {
    id: 'wdio-no-implicit-timeout', severity: 'warning',
    patterns: [/\bsetTimeout\(\s*\{[^}]*\bimplicit\s*:/],
    message: 'Implicit timeouts are not recommended in WebdriverIO: rely on auto-waiting and waitforTimeout.',
  },
  {
    id: 'wdio-sync-mode', severity: 'error',
    patterns: [/['"]@wdio\/sync['"]/, /['"]wdio-sync['"]/, /\bbrowser\.elements?\s*\(/],
    message: 'Synchronous mode and WebdriverIO v4 APIs no longer exist: use async $ / $$ and await every command.',
  },
  {
    id: 'no-absolute-xpath', severity: 'warning',
    patterns: [/["'`]\/html\b/, /["'`]\/body\//],
    message: 'Absolute XPath is fragile. Prefer ids and stable test attributes such as [data-testid="..."].',
  },
];

const ALL: SeleniumLanguage[] = ['Python', 'Java', 'JavaScript', 'Ruby', '.NET'];

const RULES: Rule[] = [
  {
    id: 'no-sleep', severity: 'error', languages: 'all',
    patterns: [
      /\btime\.sleep\s*\(/, /^\s*from time import .*\bsleep\b/, /\bThread\.sleep\s*\(/, /\bTimeUnit\.\w+\.sleep\s*\(/,
      /\bThread\.Sleep\s*\(/, /\bTask\.Delay\s*\(/, /\bdriver\.sleep\s*\(/, /new Promise\(\s*\(?\s*\w+\s*\)?\s*=>\s*setTimeout\b/,
      /^\s*sleep\s*\(?\s*\d/,
    ],
    robotPatterns: [/^\s+Sleep\s{2,}/i, /^\s+BuiltIn\.Sleep\s{2,}/i],
    message: 'No sleeping in tests. Wait explicitly for the condition the next line depends on (clickable, text present, spinner gone).',
  },
  {
    id: 'no-implicit-wait', severity: 'warning', languages: 'all',
    patterns: [/\bimplicitly_wait\s*\(/, /\bimplicitlyWait\s*\(/, /\.ImplicitWait\s*=/, /\bimplicit\s*:\s*\d/, /\bimplicit_wait\s*=/],
    robotPatterns: [/^\s+Set Selenium Implicit Wait\s{2,}(?!0\b)/i],
    message: 'Prefer explicit waits. Never mix implicit and explicit waits in the same session.',
  },
  {
    id: 'no-driver-manager', severity: 'error', languages: 'all',
    patterns: [
      /\bwebdriver_manager\b/, /\bChromeDriverManager\b/, /\bGeckoDriverManager\b/, /\bEdgeChromiumDriverManager\b/,
      /\bchromedriver_(binary|autoinstaller)\b/, /\bWebDriverManager\./, /require\(['"]chromedriver['"]\)/,
      /from ['"]chromedriver['"]/, /require ['"]webdrivers['"]/, /\bWebDriverManager\.Net\b|new DriverManager\(\)/,
    ],
    message: 'No third-party driver managers. Selenium Manager (built into Selenium 4.6+) finds, downloads and caches the driver.',
  },
  {
    id: 'no-driver-path', severity: 'error', languages: 'all',
    patterns: [
      /\bexecutable_path\s*=/, /\bService\(\s*(executable_path\s*=\s*)?r?["'][^"']+["']/, /System\.setProperty\(\s*"webdriver\.\w+\.driver"/,
      /new\s+\w*Driver(Service)?\s*\(\s*@?"[^"]*(\/|\\\\|driver)[^"]*"/, /\bdriver_path\s*=/, /new \w+\.ServiceBuilder\(\s*['"]/,
      /CreateDefaultService\(\s*@?"/,
    ],
    message: 'Don\'t hard-code driver paths. Selenium Manager resolves the driver.',
  },
  {
    id: 'no-desired-capabilities', severity: 'error', languages: 'all',
    patterns: [/\bDesiredCapabilities\b/, /\bdesired_capabilities\s*=/, /:desired_capabilities\b/, /\bAddAdditionalCapability\s*\(/],
    message: 'No DesiredCapabilities or raw capability maps. Use the browser\'s Options class (ChromeOptions, FirefoxOptions, ...).',
  },
  {
    id: 'no-selenium3-api', severity: 'error', languages: 'all',
    patterns: [
      /\.find_elements?_by_\w+\s*\(/, /\.switch_to_(alert|frame|window|default_content)\s*\(/,
      /\.findElements?By\w+\s*\(/, /\bFindElements?By\w+\s*\(/,
    ],
    message: 'Selenium 3 API: removed in Selenium 4. Use find_element(By.ID, ...) / findElement(By.id(...)) and switch_to.alert.',
  },
  {
    id: 'old-headless', severity: 'error', languages: 'all',
    patterns: [/\.headless\s*=\s*True/, /\bsetHeadless\s*\(/, /add_?[aA]rguments?\(\s*["']--headless["']\s*\)/, /addArguments\(\s*"--headless"\s*\)/],
    message: 'Old headless API. Use the Options argument "--headless=new".',
  },
  {
    id: 'java-timeunit-timeout', severity: 'error', languages: ['Java'],
    patterns: [/\b(implicitlyWait|pageLoadTimeout|setScriptTimeout|scriptTimeout)\s*\(\s*\d+\s*,\s*TimeUnit\./, /new WebDriverWait\(\s*\w+\s*,\s*\d+\s*\)/],
    message: 'Timeouts take a java.time.Duration (Duration.ofSeconds(10)), not a number with a TimeUnit.',
  },
  {
    id: 'java-browsertype', severity: 'warning', languages: ['Java'],
    patterns: [/\bBrowserType\./],
    message: 'Use the Browser enum, not BrowserType.',
  },
  {
    id: 'no-cdp', severity: 'warning', languages: 'all',
    patterns: [/\bexecute_cdp_cmd\s*\(/, /\bgetDevTools\s*\(/, /\bexecuteCdpCommand\s*\(/, /\bGetDevToolsSession\s*\(/, /\bcreateCDPConnection\s*\(/],
    message: 'Use WebDriver BiDi, not the Chrome DevTools Protocol, for console logs, JavaScript errors and network.',
  },
  {
    id: 'no-absolute-xpath', severity: 'warning', languages: 'all',
    patterns: [/["'`]\/html\b/, /["'`]\/body\//],
    message: 'Absolute XPath is fragile. Prefer id or name, then CSS on a stable attribute such as data-testid.',
  },
  {
    id: 'no-js-click', severity: 'warning', languages: 'all',
    patterns: [/arguments\[0\]\.click\(\)/],
    message: 'Don\'t click with execute_script when the element can be clicked natively: wait for it to be clickable instead.',
  },
  {
    id: 'csharp-close-not-quit', severity: 'warning', languages: ['.NET'],
    patterns: [/\bdriver\.Close\(\)\s*;\s*$/],
    message: 'Close() closes one window; teardown needs Quit() to end the session.',
  },
  {
    id: 'grid3', severity: 'error', languages: 'all',
    patterns: [/-role\s+(hub|node)\b/],
    message: 'Grid 3 invocation. Selenium Grid 4 uses subcommands: standalone, hub, node.',
  },
];

function isComment(line: string, language: SeleniumLanguage, robot: boolean): boolean {
  const t = line.trim();
  if (robot || language === 'Python' || language === 'Ruby') return t.startsWith('#');
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

/**
 * Check test code against Selenium's official guidance for AI agents.
 * Errors are patterns the docs say never to use; warnings are patterns to avoid where possible.
 */
export function checkSeleniumRules(code: string, framework: string, filename = ''): RuleViolation[] {
  if (isWebdriverIO(framework, filename)) return checkWebdriverIORules(code);
  const language = seleniumLanguage(framework, filename);
  if (!language) return [];
  const robot = framework.toLowerCase().startsWith('robot') || filename.toLowerCase().endsWith('.robot');
  const lines = code.split('\n');
  const violations: RuleViolation[] = [];
  for (const rule of RULES) {
    const langs = rule.languages === 'all' ? ALL : rule.languages;
    if (!langs.includes(language)) continue;
    const patterns = robot ? [...(rule.robotPatterns ?? []), ...rule.patterns] : rule.patterns;
    lines.forEach((line, i) => {
      if (isComment(line, language, robot)) return;
      if (patterns.some(p => p.test(line))) {
        violations.push({ rule: rule.id, severity: rule.severity, line: i + 1, code: line.trim().slice(0, 160), message: rule.message });
      }
    });
  }
  // Implicit and explicit waits in one file: the docs say never mix them, so that is an error.
  const explicit = /WebDriverWait|\bwait\.until\b|\.wait\(\s*until\.|\bWait Until\b|\bFluentWait\b|DefaultWait/;
  if (explicit.test(code)) {
    for (const v of violations) {
      if (v.rule === 'no-implicit-wait') {
        v.severity = 'error';
        v.message = 'Implicit and explicit waits are mixed. Remove the implicit wait and keep the explicit waits.';
      }
    }
  }
  return violations.sort((a, b) => a.line - b.line);
}

function checkWebdriverIORules(code: string): RuleViolation[] {
  const violations: RuleViolation[] = [];
  code.split('\n').forEach((line, i) => {
    if (isComment(line, 'JavaScript', false)) return;
    for (const rule of WDIO_RULES) {
      if (rule.patterns.some(p => p.test(line))) {
        violations.push({ rule: rule.id, severity: rule.severity, line: i + 1, code: line.trim().slice(0, 160), message: rule.message });
      }
    }
  });
  return violations;
}

/** One readable report for the agent, or null when the code follows the rules. */
export function formatRuleViolations(violations: RuleViolation[], file: string): string | null {
  if (violations.length === 0) return null;
  const errors = violations.filter(v => v.severity === 'error').length;
  const warnings = violations.length - errors;
  const wdio = violations.some(v => v.rule.startsWith('wdio-'));
  const source = wdio ? `WebdriverIO rules (${WEBDRIVERIO_BEST_PRACTICES})` : `Selenium rules (${SELENIUM_AI_AGENTS_DOCS})`;
  const head = `${source}: ${errors} error(s), ${warnings} warning(s) in ${file}`;
  const body = violations.map(v => `  ${v.severity === 'error' ? 'ERROR' : 'warn '} line ${v.line} [${v.rule}] ${v.code}\n        → ${v.message}`);
  return [head, ...body].join('\n');
}
