import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { checkSeleniumRules, RuleViolation, SELENIUM_AI_AGENTS_DOCS } from './selenium-rules.js';
import { detectProject } from '../../project-detect.js';

const SKIP_DIRS = new Set(['node_modules', '.git', '.venv', 'venv', 'env', 'target', 'build', 'dist', 'bin', 'obj', '.idea', '__pycache__', 'reports', 'results']);
const MAX_FILES = 2000;
const MAX_REPORT_LINES = 400;

/** The framework to check a file as, and whether it uses Selenium / WebdriverIO at all. */
function fileFramework(file: string, text: string, projectFramework: string | undefined, named?: string): string | null {
  const ext = path.extname(file).toLowerCase();
  const uses = (re: RegExp) => re.test(text);
  if (named) return named;
  switch (ext) {
    case '.py': return uses(/selenium|webdriver/i) ? 'selenium-python-pytest' : null;
    case '.robot':
    case '.resource': return uses(/SeleniumLibrary|Open Browser|Wait Until/i) ? 'robot-framework' : null;
    case '.java':
    case '.kt': return uses(/org\.openqa\.selenium|WebDriver/) ? 'selenium-java-maven' : null;
    case '.cs': return uses(/OpenQA\.Selenium|IWebDriver/) ? 'selenium-csharp-nunit' : null;
    case '.rb': return uses(/selenium-webdriver|Selenium::WebDriver/) ? 'selenium-ruby' : null;
    case '.js':
    case '.mjs':
    case '.cjs':
    case '.ts':
      if (uses(/selenium-webdriver/)) return 'selenium-js-mocha';
      if (uses(/@wdio\/|\bbrowser\.(url|pause|\$)|\$\(|\$\$\(/) && (projectFramework?.startsWith('webdriverio') || uses(/@wdio\//))) return 'webdriverio-ts';
      return null;
    default: return null;
  }
}

function* walk(dir: string): Generator<string> {
  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) yield* walk(path.join(dir, e.name));
    } else if (e.isFile()) {
      yield path.join(dir, e.name);
    }
  }
}

export interface ScanResult {
  root: string;
  scanned: number;
  checked: number;
  files: { file: string; framework: string; violations: RuleViolation[] }[];
}

/** Check every Selenium / WebdriverIO file under a folder (or one file) against the rules. */
export function scanForRuleViolations(target: string, named?: string): ScanResult {
  const stat = fs.statSync(target);
  const root = stat.isDirectory() ? target : path.dirname(target);
  const projectFramework = detectProject(root)?.framework;
  const candidates = stat.isDirectory() ? walk(target) : [target][Symbol.iterator]();
  const files: ScanResult['files'] = [];
  let scanned = 0;
  let checked = 0;
  for (const file of candidates) {
    if (++scanned > MAX_FILES) break;
    let text: string;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const framework = fileFramework(file, text, projectFramework, named);
    if (!framework) continue;
    checked++;
    const violations = checkSeleniumRules(text, framework, path.basename(file));
    if (violations.length) files.push({ file: path.relative(root, file) || path.basename(file), framework, violations });
  }
  files.sort((a, b) => b.violations.filter(v => v.severity === 'error').length - a.violations.filter(v => v.severity === 'error').length);
  return { root, scanned: Math.min(scanned, MAX_FILES), checked, files };
}

export function formatScan(r: ScanResult): string {
  const all = r.files.flatMap(f => f.violations);
  const errors = all.filter(v => v.severity === 'error').length;
  const byRule = new Map<string, { count: number; severity: string; message: string }>();
  for (const v of all) {
    const entry = byRule.get(v.rule) ?? { count: 0, severity: v.severity, message: v.message };
    entry.count++;
    if (v.severity === 'error') entry.severity = 'error';
    byRule.set(v.rule, entry);
  }
  const lines = [
    `Scanned ${r.root}: ${r.checked} Selenium/WebdriverIO file(s) checked, ` +
      `${r.files.length} with findings: ${errors} error(s), ${all.length - errors} warning(s).`,
  ];
  if (r.files.length === 0) {
    lines.push('', 'Everything follows the rules: nothing to migrate.');
    return lines.join('\n');
  }
  lines.push('', 'By rule:');
  for (const [rule, e] of [...byRule.entries()].sort((a, b) => b[1].count - a[1].count)) {
    lines.push(`  ${String(e.count).padStart(4)} × ${e.severity === 'error' ? 'ERROR' : 'warn '} [${rule}] ${e.message}`);
  }
  lines.push('', 'By file (most errors first):');
  let budget = MAX_REPORT_LINES;
  for (const f of r.files) {
    if (budget <= 0) { lines.push(`  ... ${r.files.length} files in total; scan a sub-folder for the rest.`); break; }
    const e = f.violations.filter(v => v.severity === 'error').length;
    lines.push(`  ${f.file} (${f.framework}): ${e} error(s), ${f.violations.length - e} warning(s)`);
    for (const v of f.violations) {
      if (--budget <= 0) break;
      lines.push(`    ${v.severity === 'error' ? 'ERROR' : 'warn '} line ${v.line} [${v.rule}] ${v.code}`);
    }
  }
  lines.push('', `Rules: ${SELENIUM_AI_AGENTS_DOCS}. Fix a file with healer_fix_test, which refuses code that still breaks them.`);
  return lines.join('\n');
}

const schema = z.object({
  path: z.string().describe('A test folder (scanned recursively; node_modules, .venv, target, build ... are skipped) or one test file'),
  framework: z.string().optional()
    .describe('Check every file as this framework (e.g. selenium-java-maven). Default: from each file and the project'),
});

export class SeleniumRulesCheckTool extends BaseTool {
  readonly name = 'selenium_rules_check';
  readonly description = `Scan existing tests for outdated or flaky patterns, before a migration or review: Selenium 3 APIs
(find_element_by_*, findElementBy*, DesiredCapabilities, new WebDriverWait(driver, 10), TimeUnit timeouts),
sleeps, implicit waits mixed with explicit ones, driver managers and driver paths, the old headless API, absolute
XPath; Robot Framework Sleep / Set Selenium Speed; WebdriverIO browser.pause() and removed v10 APIs.

It checks every Selenium / WebdriverIO file in Python, Java, C#, JavaScript/TypeScript, Ruby and Robot Framework
against Selenium's official rules for AI agents (${SELENIUM_AI_AGENTS_DOCS}) and lists the findings per rule and per
file, with line numbers. It changes nothing. Use it to plan a Selenium 3 → 4 migration, then fix one file at a time.`;
  readonly inputSchema = schema;
  // Reads files only: no page snapshot afterwards.
  readonly category: ToolCategory = 'generator';

  async execute(_context: Context, params: unknown): Promise<ToolResult> {
    const { path: target, framework } = this.parseParams(schema, params);
    if (!fs.existsSync(target)) return this.error(`Not found: ${target}`);
    try {
      return this.success(formatScan(scanForRuleViolations(path.resolve(target), framework)), false);
    } catch (err) {
      return this.error(`Could not scan ${target}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
