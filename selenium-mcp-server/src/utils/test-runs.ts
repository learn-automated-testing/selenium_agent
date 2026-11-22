/**
 * The latest test results, kept by healer_run_tests in <output>/.test-runs.json for the plans overview:
 * the last run of the whole suite, and the last result per test file when a single file was run.
 */
import { getOutputDir } from './paths.js';

export interface SuiteRun { at: string; command: string; passed: boolean; exitCode: number; summary: string }
export interface FileRun { passed: boolean; at: string; total?: number; failed?: number; skipped?: number }
/** The latest result of a plan scenario, keyed "<plan.md>#<scenario>", e.g. "checkboxes.md#1.2". */
export interface ScenarioRun { status: 'passed' | 'failed' | 'skipped'; at: string; testFile?: string; message?: string }
export interface TestRuns { suite: SuiteRun | null; files: Record<string, FileRun>; scenarios: Record<string, ScenarioRun> }

/** The per-test results of a run, from its JUnit XML (see src/reporting/results.ts). */
export interface RunCases {
  summary: { total: number; passed: number; failed: number; skipped: number; time: number };
  cases: Array<{ status: 'passed' | 'failed' | 'skipped'; testFile?: string; message?: string; link?: { plan: string; scenario?: string } }>;
}

export const TEST_RUNS_FILE = '.test-runs.json';

/** The line a runner prints as its result: pytest, Maven/JUnit, dotnet test, Mocha, Jest, WebdriverIO, Robot. */
export function runSummary(output: string): string {
  const lines = output.split('\n').map(l => l.replace(/\x1b\[[0-9;]*m/g, '').trim()).filter(Boolean);
  const patterns = [
    /\b\d+ (passed|failed)\b.*\bin [\d.]+s\b/, /^(Passed|Failed)!\s+-/, /Tests run: \d+, Failures: \d+, Errors: \d+, Skipped: \d+$/,
    /\b\d+ passing\b/, /^Tests:\s+\d+/, /^Spec Files:\s+/, /^\d+ tests?, \d+ passed, \d+ failed/, /\b\d+ (passed|failed)\b/,
    /BUILD (SUCCESS|FAILURE)/,
  ];
  for (const p of patterns) {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (p.test(lines[i])) return lines[i].replace(/^=+\s*|\s*=+$/g, '').replace(/^\[INFO\]\s*/, '').slice(0, 160);
    }
  }
  return '';
}

export async function readTestRuns(dir = getOutputDir()): Promise<TestRuns> {
  const fs = await import('fs/promises');
  const path = await import('path');
  try {
    const runs = JSON.parse(await fs.readFile(path.join(dir, TEST_RUNS_FILE), 'utf-8')) as TestRuns;
    return { suite: runs.suite ?? null, files: runs.files ?? {}, scenarios: runs.scenarios ?? {} };
  } catch {
    return { suite: null, files: {}, scenarios: {} };
  }
}

const rank = { failed: 2, skipped: 1, passed: 0 } as const;

/**
 * Record a run. With its JUnit results: per test file and per plan scenario. Without them: per file when one test
 * file was run, else as the last run of the suite. Never throws.
 */
export async function recordTestRun(run: { testPath?: string; command: string; exitCode: number; output: string; results?: RunCases | null }, dir = getOutputDir()): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const runs = await readTestRuns(dir);
    const at = new Date().toISOString();
    const passed = run.exitCode === 0;
    const r = run.results;
    if (r?.cases.length) {
      const perFile = new Map<string, FileRun>();
      for (const c of r.cases) {
        if (c.testFile) {
          const f = perFile.get(c.testFile) ?? { passed: true, at, total: 0, failed: 0, skipped: 0 };
          f.total! += 1;
          if (c.status === 'failed') { f.failed! += 1; f.passed = false; }
          if (c.status === 'skipped') f.skipped! += 1;
          perFile.set(c.testFile, f);
        }
        if (c.link?.scenario) {
          const key = `${c.link.plan}#${c.link.scenario}`;
          const prev = runs.scenarios[key];
          // Several cases for one scenario in this run: the worst result counts.
          if (!prev || prev.at !== at || rank[c.status] > rank[prev.status]) {
            runs.scenarios[key] = { status: c.status, at, ...(c.testFile ? { testFile: c.testFile } : {}), ...(c.message ? { message: c.message } : {}) };
          }
        }
      }
      for (const [file, f] of perFile) runs.files[path.resolve(file)] = f;
    } else if (run.testPath) {
      runs.files[path.resolve(run.testPath)] = { passed, at };
    }
    if (!run.testPath) {
      const s = r?.summary;
      const summary = s?.total ? `${s.passed} passed, ${s.failed} failed${s.skipped ? `, ${s.skipped} skipped` : ''} in ${s.time}s` : runSummary(run.output);
      runs.suite = { at, command: run.command, passed, exitCode: run.exitCode, summary };
    }
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, TEST_RUNS_FILE), JSON.stringify(runs, null, 2));
  } catch { /* the overview is a convenience: never fail a test run over it */ }
}
