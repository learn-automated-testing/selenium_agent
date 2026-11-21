/**
 * Project instruction files with the browser-automation rules, for the AI tools that read them:
 * CLAUDE.md (Claude Code), .cursor/rules/selenium.mdc (Cursor), .github/copilot-instructions.md (GitHub Copilot),
 * .windsurf/rules/selenium.md (Windsurf) and AGENTS.md (Codex and others), as Selenium's guide for AI agents
 * recommends (https://www.selenium.dev/documentation/ai_agents/).
 *
 * The rules go in a marked section, so running it again replaces that section and leaves the rest of the file alone.
 */
import fs from 'fs';
import path from 'path';
import { seleniumLanguage, isWebdriverIO } from './tools/agents/selenium-rules.js';
import { detectProject } from './project-detect.js';

export const RULES_TARGETS = {
  claude: 'CLAUDE.md',
  cursor: '.cursor/rules/selenium.mdc',
  copilot: '.github/copilot-instructions.md',
  windsurf: '.windsurf/rules/selenium.md',
  agents: 'AGENTS.md',
  junie: '.junie/AGENTS.md',
} as const;
export type RulesTarget = keyof typeof RULES_TARGETS;

export const RULES_START = '<!-- selenium-ai-agent:rules:start -->';
export const RULES_END = '<!-- selenium-ai-agent:rules:end -->';

/** The framework of the tests in a project, from its files (default: Python with pytest). */
export function detectFramework(cwd: string): string {
  return detectProject(cwd)?.framework ?? 'selenium-python-pytest';
}

/** The Selenium (or WebdriverIO) version a project pins, if it does. */
export function detectVersion(cwd: string, framework: string): string | null {
  const read = (f: string) => { try { return fs.readFileSync(path.join(cwd, f), 'utf8'); } catch { return ''; } };
  if (isWebdriverIO(framework)) {
    return /"(?:webdriverio|@wdio\/cli)"\s*:\s*"[~^]?(\d+(?:\.\d+){0,2})/.exec(read('package.json'))?.[1] ?? null;
  }
  const patterns: [string, RegExp][] = [
    ['package.json', /"selenium-webdriver"\s*:\s*"[~^]?(\d+(?:\.\d+){1,2})/],
    ['pom.xml', /<selenium\.version>(\d+(?:\.\d+){1,2})<|<artifactId>selenium-java<\/artifactId>\s*<version>(\d+(?:\.\d+){1,2})</],
    ['requirements.txt', /^selenium\s*[=~>]=\s*(\d+(?:\.\d+){1,2})/m],
    ['pyproject.toml', /["']selenium\s*[=~>]=\s*(\d+(?:\.\d+){1,2})/],
    ['build.gradle', /selenium-java:(\d+(?:\.\d+){1,2})/],
  ];
  for (const [file, re] of patterns) {
    const m = re.exec(read(file));
    if (m) return m[1] ?? m[2];
  }
  return null;
}

const LANGUAGE_NOTES: Record<string, string[]> = {
  Python: [
    '`driver.find_element(By.ID, "...")`; the `find_element_by_*` methods were removed in Selenium 4.3.',
    'Pass `options=` and `service=`; `executable_path` and `desired_capabilities` were removed in 4.10.',
    'Headless: `options.add_argument("--headless=new")`, not `options.headless = True`.',
  ],
  Java: [
    'Timeouts take a `java.time.Duration` (`Duration.ofSeconds(10)`), not a number with a `TimeUnit`.',
    '`driver.findElement(By.id("..."))`; the `findElementBy*` helpers were removed.',
    '`ChromeOptions`, `FirefoxOptions`, ... instead of `DesiredCapabilities`; headless with `addArguments("--headless=new")`.',
  ],
  JavaScript: [
    'Every command returns a promise: `await` all of them, including `driver.quit()`.',
    'Build the driver with `new Builder().forBrowser(Browser.CHROME).build()`; wait with `driver.wait(until..., timeout)`.',
  ],
  '.NET': [
    'The browser\'s Options class instead of `DesiredCapabilities`; `AddAdditionalOption`, not `AddAdditionalCapability`.',
    'No driver directory in the `ChromeDriver` constructor. Teardown calls `Quit()`, not `Close()`.',
  ],
  Ruby: ['Pass `options:`; no `:desired_capabilities`, no `Chrome.driver_path=`, no `webdrivers` gem.'],
};

/** The rules section for one framework, in the shape Selenium's (or WebdriverIO's) guide for AI agents recommends. */
export function projectRulesSection(framework: string, version: string | null): string {
  if (isWebdriverIO(framework)) {
    return [
      `## End-to-end tests (WebdriverIO${version ? ` ${version}` : ' v10'})`,
      '',
      '- Docs index: https://webdriver.io/llms.txt; guide for AI agents: https://webdriver.io/docs/ai-agents.',
      '  Read the docs page (append `.md` to its URL, or use the `get_selenium_docs` tool with `framework: "webdriverio"`)',
      '  before using an API you are not sure of. An API that is not in the current docs does not exist.',
      '- Use v10 APIs only: nothing from WebdriverIO v8 or older (see https://webdriver.io/docs/v10-migration).',
      '- `await` every command. Never `browser.pause()`: rely on auto-waiting and `expect-webdriverio` matchers',
      '  (`toBeDisplayed`, `toHaveText`, ...), or `waitForDisplayed` / `waitForEnabled` / `browser.waitUntil()`.',
      '- Selectors: what the user sees first (`aria/...`, `button=...`), then `[data-testid="..."]`. No XPath or generated classes.',
      '  `$()` is strict: it must match exactly one element.',
      '- Run one spec while iterating: `npx wdio run wdio.conf.ts --spec <file>`; run it several times before trusting it.',
      '- selenium-ai-agent checks generated tests against these rules (`generator_write_test`, `healer_fix_test`).',
    ].join('\n');
  }
  const language = seleniumLanguage(framework) ?? 'Python';
  const robot = framework.toLowerCase().startsWith('robot');
  const lines = [
    `## Browser automation (Selenium${version ? ` ${version}` : ' 4'}${robot ? ', Robot Framework SeleniumLibrary' : ''})`,
    '',
    '- Docs index: https://www.selenium.dev/llms.txt. Examples (tested in CI):',
    '  https://github.com/SeleniumHQ/seleniumhq.github.io/tree/trunk/examples',
    '- Before using an API you are not sure of, read its docs page: add `index.md` to the page URL',
    '  (https://www.selenium.dev/documentation/webdriver/waits/index.md), or use the `get_selenium_docs` tool.',
    '  An API that is not in the current docs or API reference does not exist. Don\'t use the legacy docs or CDP pages.',
    version ? `- Selenium version: ${version}. Don't use Selenium 3 or older APIs.` : '- Use current Selenium 4 APIs; don\'t use Selenium 3 or older APIs.',
    '- Drivers: Selenium Manager finds, downloads and caches them. No driver-manager dependency, no driver paths.',
    '- Configuration: the browser\'s Options class; headless is `--headless=new`. No `DesiredCapabilities`.',
    '- Waiting: explicit waits for the condition the next line depends on. Never sleep, and never mix implicit and explicit waits.',
    '- Flaky test? Find the condition that was not yet true; don\'t add a sleep or a longer timeout.',
    '- Sessions: a fresh session per test, quit in teardown, no shared drivers.',
    '- Locators: `id` and `name` first, then CSS on a stable attribute such as `data-testid`. No absolute XPath.',
    '- Events and network: WebDriver BiDi, not the Chrome DevTools Protocol.',
    '- Run a single test while iterating, then several times before trusting it.',
  ];
  if (robot) {
    lines.push('- Robot Framework: no `Sleep` or `Set Selenium Speed`; use the `Wait Until ...` keywords. `Open Browser` with',
      '  `options=` in the test setup, `Close Browser` in the teardown. Keyword docs: https://robotframework.org/SeleniumLibrary/SeleniumLibrary.html');
  } else {
    for (const note of LANGUAGE_NOTES[language] ?? []) lines.push(`- ${language === '.NET' ? 'C#' : language}: ${note}`);
  }
  lines.push('- Guide: https://www.selenium.dev/documentation/ai_agents/. selenium-ai-agent checks generated tests against these',
    '  rules (`generator_write_test`, `healer_fix_test`); the full rules are the MCP resource `selenium://rules/' +
    (robot ? 'robot-framework' : { Python: 'python', Java: 'java', JavaScript: 'javascript', '.NET': 'csharp', Ruby: 'ruby' }[language]) + '`.');
  return lines.join('\n');
}

/**
 * Junie (JetBrains) reads .junie/AGENTS.md if it exists, and then nothing else; otherwise .junie/guidelines.md or
 * the .md files in .junie/guidelines/. Write into the file Junie already reads, so existing guidelines stay in use.
 */
export function junieRulesFile(cwd: string): string {
  const exists = (f: string) => fs.existsSync(path.join(cwd, f));
  if (exists('.junie/AGENTS.md')) return '.junie/AGENTS.md';
  if (exists('.junie/guidelines.md')) return '.junie/guidelines.md';
  if (exists('.junie/guidelines')) return '.junie/guidelines/selenium.md';
  return '.junie/AGENTS.md';
}

const CURSOR_FRONT_MATTER = [
  '---',
  'description: Browser automation rules (Selenium / WebdriverIO) from the projects\' guides for AI agents',
  'alwaysApply: true',
  '---',
  '',
].join('\n');

/** Put the section between the markers: replace an earlier one, or append it. */
export function upsertSection(existing: string, section: string): string {
  const block = `${RULES_START}\n${section}\n${RULES_END}`;
  const start = existing.indexOf(RULES_START);
  const end = existing.indexOf(RULES_END);
  if (start >= 0 && end > start) {
    return existing.slice(0, start) + block + existing.slice(end + RULES_END.length);
  }
  if (!existing.trim()) return block + '\n';
  return existing.replace(/\s*$/, '') + '\n\n' + block + '\n';
}

export interface WriteRulesOptions {
  cwd?: string;
  targets: RulesTarget[];
  framework?: string;
}

export interface WriteRulesResult {
  framework: string;
  version: string | null;
  written: { file: string; action: 'created' | 'updated' }[];
}

/** Write (or update) the rules section in the instruction file of each target. */
export function writeProjectRules(opts: WriteRulesOptions): WriteRulesResult {
  const cwd = opts.cwd ?? process.cwd();
  const framework = opts.framework ?? detectFramework(cwd);
  const version = detectVersion(cwd, framework);
  const section = projectRulesSection(framework, version);
  const written: WriteRulesResult['written'] = [];
  for (const target of [...new Set(opts.targets)]) {
    const file = target === 'junie' ? junieRulesFile(cwd) : RULES_TARGETS[target];
    const full = path.join(cwd, file);
    const exists = fs.existsSync(full);
    let existing = exists ? fs.readFileSync(full, 'utf8') : '';
    if (target === 'cursor' && !existing) existing = CURSOR_FRONT_MATTER;
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, upsertSection(existing, section));
    written.push({ file, action: exists ? 'updated' : 'created' });
  }
  return { framework, version, written };
}
