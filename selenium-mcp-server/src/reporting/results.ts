/**
 * After a test run: find the results the runner wrote (JUnit XML, Allure), link every test case to the approved plan
 * and scenario it implements, and write that link back into the reports the team already uses:
 *  - reports/junit-plans.xml: the JUnit results with plan, scenario and review status as test case properties
 *  - allure-results: epic (plan), feature (suite) and story (scenario) labels, so Allure's Behaviors tab is the plan
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseJUnitXml, summarize, encodeXml, type TestCaseResult, type ResultSummary } from './junit.js';
import { reportingFor } from './frameworks.js';
import { parsePlan, type ParsedPlan } from '../plan-pages.js';
import { planStatus } from '../utils/plan-review.js';
import type { TestManifest } from '../types/manifest.js';

/** Where runners put JUnit XML by default, besides what the framework's setup says. */
const COMMON_JUNIT = ['reports', 'reports/junit', 'test-results', 'target/surefire-reports', 'target/failsafe-reports',
  'build/test-results/test', 'results', 'TestResults', 'junit.xml'];

export interface PlanLink {
  plan: string;
  planTitle: string;
  scenario?: string;
  scenarioName?: string;
  suite?: string;
  review: string;
}

export interface LinkedCase extends TestCaseResult { testFile?: string; link?: PlanLink }

export interface RunReport {
  files: string[];
  summary: ResultSummary;
  cases: LinkedCase[];
  /** Test cases with no approved plan behind them. */
  unlinked: number;
  written: string[];
  /** How to view the Allure report, when Allure results were written. */
  view?: string;
}

/** Allure 3 groups by suite unless told otherwise: this config shows the approved plan as the tree. */
export const ALLURERC = `// Written by selenium-ai-agent: show the report as your approved test plans (plan > suite > scenario).
export default {
  name: "Test report",
  output: "./allure-report",
  plugins: { awesome: { options: { groupBy: ["epic", "feature", "story"] } } },
};
`;

export const ALLURE_VIEW_COMMAND = 'npx allure generate allure-results && npx allure open allure-report';

/**
 * Make sure Allure 3 shows the plan tree: write allurerc.mjs when the project has no Allure config yet.
 * Returns the file written, or undefined when one was already there.
 */
export async function ensureAllureConfig(projectRoot: string): Promise<string | undefined> {
  const names = ['allurerc.mjs', 'allurerc.js', 'allurerc.cjs', 'allurerc.json', 'allurerc.yml', 'allurerc.yaml'];
  for (const n of names) {
    try {
      await fs.access(path.join(projectRoot, n));
      return undefined;
    } catch { /* not there */ }
  }
  const file = path.join(projectRoot, 'allurerc.mjs');
  await fs.writeFile(file, ALLURERC);
  return file;
}

async function filesIn(target: string, since: number, pattern: RegExp): Promise<string[]> {
  try {
    const st = await fs.stat(target);
    if (st.isFile()) return pattern.test(target) && st.mtimeMs >= since ? [target] : [];
    const out: string[] = [];
    for (const f of await fs.readdir(target)) {
      const full = path.join(target, f);
      try {
        const s = await fs.stat(full);
        if (s.isFile() && pattern.test(f) && s.mtimeMs >= since) out.push(full);
      } catch { /* gone */ }
    }
    return out;
  } catch {
    return [];
  }
}

/** JUnit XML files written since the run started (a second of slack for coarse file times). */
export async function findJUnitFiles(projectRoot: string, framework: string, since: number): Promise<string[]> {
  const r = reportingFor(framework);
  const targets = [...new Set([...(r?.junit.results ?? []), ...COMMON_JUNIT])].map(t => path.resolve(projectRoot, t));
  const found = new Set<string>();
  for (const t of targets) for (const f of await filesIn(t, since - 1000, /\.xml$/i)) found.add(f);
  // Our own enriched copy is an output, not an input.
  return [...found].filter(f => path.basename(f) !== JUNIT_PLANS_FILE).sort();
}

export const JUNIT_PLANS_FILE = 'junit-plans.xml';

const dotted = (p: string) => p.replace(/\.[^./\\]+$/, '').split(/[\\/]+/).filter(Boolean).join('.');
const norm = (s: string) => s.toLowerCase().replace(/[\s-]+/g, '_');

/** Does this result (by classname, file or Allure full name) belong to this test file? */
export function caseMatchesFile(c: { classname: string; file?: string }, testFile: string, projectRoot: string): boolean {
  const rel = path.relative(projectRoot, testFile);
  if (c.file) {
    const f = path.isAbsolute(c.file) ? c.file : path.resolve(projectRoot, c.file);
    if (path.resolve(f) === path.resolve(testFile)) return true;
  }
  if (!c.classname) return false;
  const cls = c.classname;
  const relDotted = dotted(rel);
  if (cls === relDotted || cls.startsWith(`${relDotted}.`) || relDotted.endsWith(`.${cls}`)) return true;
  // Java/C#: package.Class with src/test/java/...; JS/Robot: a suite named after the file.
  const base = norm(path.basename(testFile).replace(/\.[^.]+$/, '').replace(/\.(spec|test)$/, ''));
  const segments = cls.split('.').map(norm);
  return segments.includes(base) || segments[segments.length - 1] === base;
}

async function readPlans(specsDir: string): Promise<Array<{ file: string; markdown: string; plan: ParsedPlan }>> {
  const out: Array<{ file: string; markdown: string; plan: ParsedPlan }> = [];
  try {
    for (const f of (await fs.readdir(specsDir)).filter(f => f.endsWith('.md')).sort()) {
      const markdown = await fs.readFile(path.join(specsDir, f), 'utf8');
      if (planStatus(markdown) !== null || /^#{2,3}\s+Test Scenarios\b/im.test(markdown)) out.push({ file: f, markdown, plan: parsePlan(markdown) });
    }
  } catch { /* no plans */ }
  return out;
}

const samePath = (a: string, b: string, root: string) =>
  path.resolve(root, a) === path.resolve(root, b) || a.replace(/\\/g, '/').endsWith(b.replace(/\\/g, '/')) || b.replace(/\\/g, '/').endsWith(a.replace(/\\/g, '/'));

/**
 * The plan and scenario a test file implements: the plan's "File:" line for that test (the planner writes it), else
 * the plan the manifest records for the file (generator_write_test specFile) with the scenario it was given.
 */
export function linkFor(testFile: string, manifest: TestManifest | null, plans: Array<{ file: string; markdown: string; plan: ParsedPlan }>, projectRoot: string): PlanLink | undefined {
  const entry = manifest?.tests.find(t => path.resolve(t.file) === path.resolve(testFile));
  const specName = entry?.specFile ? path.basename(entry.specFile.endsWith('.md') ? entry.specFile : `${entry.specFile}.md`) : undefined;
  const ordered = specName ? [...plans.filter(p => p.file === specName), ...plans.filter(p => p.file !== specName)] : plans;
  for (const p of ordered) {
    for (const s of p.plan.suites) {
      for (const t of s.tests) {
        const byScenario = entry?.scenario && p.file === specName && t.id === entry.scenario;
        if (byScenario || (t.file && samePath(t.file, path.relative(projectRoot, testFile), projectRoot))) {
          return { plan: p.file, planTitle: p.plan.title, scenario: t.id, scenarioName: t.name, suite: s.name, review: review(p.markdown) };
        }
      }
    }
  }
  const p = plans.find(x => x.file === specName);
  return p ? { plan: p.file, planTitle: p.plan.title, review: review(p.markdown) } : undefined;
}

function review(markdown: string): string {
  const status = planStatus(markdown) ?? 'no status';
  const note = /^\s*\*{0,2}Status:?\*{0,2}\s*:?\s*\*{0,2}(?:draft|approved|changes requested)\b\s*[—-]?\s*(.*)$/im.exec(markdown)?.[1]?.trim();
  return note && status === 'approved' ? `approved (${note.replace(/^approved\s*/i, '').slice(0, 120)})` : status;
}

/** Link every case to a test file of the manifest and, through it, to its plan and scenario. */
export async function linkCases(cases: TestCaseResult[], projectRoot: string, manifest: TestManifest | null, specsDir: string): Promise<LinkedCase[]> {
  const plans = await readPlans(specsDir);
  const files = (manifest?.tests ?? []).map(t => t.file);
  // Plan files that are not in the manifest (tests written by hand from a plan) still link through "File:".
  for (const p of plans) for (const s of p.plan.suites) for (const t of s.tests) if (t.file) files.push(path.resolve(projectRoot, t.file));
  const unique = [...new Set(files.map(f => path.resolve(f)))];
  return cases.map(c => {
    const testFile = unique.find(f => caseMatchesFile(c, f, projectRoot));
    const link = testFile ? linkFor(testFile, manifest, plans, projectRoot) : undefined;
    return { ...c, ...(testFile ? { testFile } : {}), ...(link ? { link } : {}) };
  });
}

/** JUnit XML of the linked cases, with plan, scenario and review status as properties of each test case. */
export function junitWithPlans(cases: LinkedCase[], name = 'selenium-ai-agent'): string {
  const s = summarize(cases);
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites name="${encodeXml(name)}" tests="${s.total}" failures="${s.failed}" skipped="${s.skipped}" time="${s.time}">`,
    `  <testsuite name="${encodeXml(name)}" tests="${s.total}" failures="${s.failed}" skipped="${s.skipped}" time="${s.time}">`];
  for (const c of cases) {
    const props: Array<[string, string]> = c.link
      ? [['plan', c.link.plan], ['plan.title', c.link.planTitle], ['plan.review', c.link.review],
        ...(c.link.scenario ? [['scenario', `${c.link.scenario} ${c.link.scenarioName ?? ''}`.trim()] as [string, string]] : []),
        ...(c.link.suite ? [['suite', c.link.suite] as [string, string]] : [])]
      : [['plan', 'none: no approved plan behind this test']];
    lines.push(`    <testcase name="${encodeXml(c.name)}" classname="${encodeXml(c.classname)}" time="${c.time}"${c.testFile ? ` file="${encodeXml(c.testFile)}"` : ''}>`);
    lines.push('      <properties>', ...props.map(([k, v]) => `        <property name="${encodeXml(k)}" value="${encodeXml(v)}"/>`), '      </properties>');
    if (c.status === 'failed') lines.push(`      <failure message="${encodeXml(c.message ?? 'failed')}"/>`);
    if (c.status === 'skipped') lines.push('      <skipped/>');
    lines.push('    </testcase>');
  }
  lines.push('  </testsuite>', '</testsuites>', '');
  return lines.join('\n');
}

/**
 * Add the plan to Allure results written since the run started: epic = plan, feature = suite, story = scenario,
 * plus plan and review labels. Allure's Behaviors tab then shows the approved plan with a result per scenario.
 * Returns the number of results changed.
 */
export async function labelAllureResults(dir: string, since: number, projectRoot: string, manifest: TestManifest | null, specsDir: string): Promise<number> {
  const files = await filesIn(dir, since - 1000, /-result\.json$/);
  if (!files.length) return 0;
  const plans = await readPlans(specsDir);
  const testFiles = [...new Set([...(manifest?.tests ?? []).map(t => path.resolve(t.file)),
    ...plans.flatMap(p => p.plan.suites.flatMap(s => s.tests.flatMap(t => (t.file ? [path.resolve(projectRoot, t.file)] : []))))])];
  let changed = 0;
  for (const f of files) {
    try {
      const result = JSON.parse(await fs.readFile(f, 'utf8')) as { fullName?: string; labels?: Array<{ name: string; value: string }> };
      const labels = result.labels ?? [];
      const label = (n: string) => labels.find(l => l.name === n)?.value;
      const classname = (result.fullName ?? '').split('#')[0] || label('testClass') || label('package') || label('suite') || '';
      const testFile = testFiles.find(t => caseMatchesFile({ classname, file: label('testFile') }, t, projectRoot)
        || caseMatchesFile({ classname: label('package') ?? '' }, t, projectRoot));
      const link = testFile ? linkFor(testFile, manifest, plans, projectRoot) : undefined;
      if (!link) continue;
      const set = (name: string, value: string | undefined) => {
        if (!value) return;
        const i = labels.findIndex(l => l.name === name);
        if (i >= 0) labels[i] = { name, value }; else labels.push({ name, value });
      };
      set('epic', link.planTitle);
      set('feature', link.suite);
      set('story', link.scenario ? `${link.scenario} ${link.scenarioName ?? ''}`.trim() : undefined);
      set('plan', link.plan);
      set('planReview', link.review);
      if (!labels.some(l => l.name === 'tag' && l.value === 'approved-plan') && link.review.startsWith('approved')) labels.push({ name: 'tag', value: 'approved-plan' });
      result.labels = labels;
      await fs.writeFile(f, JSON.stringify(result));
      changed++;
    } catch { /* not a result file we understand */ }
  }
  return changed;
}

/**
 * Everything after a run: read the JUnit XML, link the cases to plans, write reports/junit-plans.xml and label the
 * Allure results. Never throws: reporting must not break a test run.
 */
export async function collectRunReport(opts: {
  projectRoot: string; framework: string; since: number; manifest: TestManifest | null; specsDir: string;
}): Promise<RunReport | null> {
  try {
    const files = await findJUnitFiles(opts.projectRoot, opts.framework, opts.since);
    const written: string[] = [];
    const allureDirs = [...new Set([...(reportingFor(opts.framework)?.allure.results ?? []), 'allure-results'])].map(d => path.resolve(opts.projectRoot, d));
    let labelled = 0;
    for (const d of allureDirs) labelled += await labelAllureResults(d, opts.since, opts.projectRoot, opts.manifest, opts.specsDir);
    let view: string | undefined;
    if (labelled) {
      written.push(`${labelled} Allure result(s) labelled with their plan`);
      const config = await ensureAllureConfig(opts.projectRoot).catch(() => undefined);
      if (config) written.push(`${config} (Allure 3: the report shows plan > suite > scenario)`);
      view = `${ALLURE_VIEW_COMMAND} (Allure 3 via npx, no install or Java needed; with Allure 2: allure serve allure-results, Behaviors tab)`;
    }
    if (!files.length) return labelled ? { files: [], summary: summarize([]), cases: [], unlinked: 0, written, view } : null;
    const cases: TestCaseResult[] = [];
    for (const f of files) cases.push(...parseJUnitXml(await fs.readFile(f, 'utf8')));
    const linked = await linkCases(cases, opts.projectRoot, opts.manifest, opts.specsDir);
    const out = path.join(opts.projectRoot, 'reports', JUNIT_PLANS_FILE);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, junitWithPlans(linked));
    written.unshift(out);
    return { files, summary: summarize(linked), cases: linked, unlinked: linked.filter(c => !c.link).length, written, ...(view ? { view } : {}) };
  } catch {
    return null;
  }
}
