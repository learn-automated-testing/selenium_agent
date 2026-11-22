/**
 * The latest test results, kept by healer_run_tests in <output>/.test-runs.json for the plans overview:
 * the last run of the whole suite, and the last result per test file when a single file was run.
 */
import { getOutputDir } from './paths.js';

export interface SuiteRun { at: string; command: string; passed: boolean; exitCode: number; summary: string }
export interface TestRuns { suite: SuiteRun | null; files: Record<string, { passed: boolean; at: string }> }

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
    return { suite: runs.suite ?? null, files: runs.files ?? {} };
  } catch {
    return { suite: null, files: {} };
  }
}

/** Record a run: per file when one test file was run, else as the last run of the suite. Never throws. */
export async function recordTestRun(run: { testPath?: string; command: string; exitCode: number; output: string }, dir = getOutputDir()): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const runs = await readTestRuns(dir);
    const at = new Date().toISOString();
    const passed = run.exitCode === 0;
    if (run.testPath) runs.files[path.resolve(run.testPath)] = { passed, at };
    else runs.suite = { at, command: run.command, passed, exitCode: run.exitCode, summary: runSummary(run.output) };
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, TEST_RUNS_FILE), JSON.stringify(runs, null, 2));
  } catch { /* the overview is a convenience: never fail a test run over it */ }
}
