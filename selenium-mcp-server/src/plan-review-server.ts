/**
 * A small local web server for reviewing test plans in the browser: the overview of all plans and a review page per
 * plan, whose Approve and Request changes buttons write the decision into the plan's Markdown.
 *
 * It listens on 127.0.0.1 only, on a free port, and every request needs the random token in its URL, so other
 * sites and other users on the machine cannot read or change plans. It only reads and writes test plans (.md files
 * with the plan layout) directly in the specs folder; its read-only HTML copies go to the agent's own folder,
 * .selenium-ai-agent/review/, never into the user's folders.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { defaultOutputDir, getAgentFilesDir, getOutputDir, getSpecsDir, specsDirFor } from './utils/paths.js';
import { isPlanMarkdown, planReviewRequired, withPlanStatus, withReviewComments, planStatus, type ReviewComment } from './utils/plan-review.js';
import { renderOverviewPage, renderPlanPage, statusPill, type OverviewRow, type ScenarioResult } from './plan-pages.js';
import { readManifest } from './types/manifest.js';
import { readTestRuns } from './utils/test-runs.js';

let server: http.Server | null = null;
let base = '';
const token = crypto.randomBytes(18).toString('hex');

const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

/** A plan file name in specs/: no folders, no traversal, Markdown only. */
function planPath(name: string | null): string | null {
  if (!name || name !== path.basename(name) || !/^[\w.-]+\.md$/.test(name)) return null;
  return path.join(getSpecsDir(), name);
}

/** The test plans in a folder: Markdown files with the plan layout. Other documents in the same folder are left alone. */
export async function listPlans(dir = getSpecsDir()): Promise<string[]> {
  let names: string[];
  try {
    names = (await fs.readdir(dir)).filter(f => f.endsWith('.md') && f.toLowerCase() !== 'readme.md').sort();
  } catch {
    return [];
  }
  const plans: string[] = [];
  for (const name of names) {
    try {
      if (isPlanMarkdown(await fs.readFile(path.join(dir, name), 'utf-8'))) plans.push(name);
    } catch { /* unreadable: not ours */ }
  }
  return plans;
}

/**
 * What else is in the plans folder: files and folders that are not test plans (a README and the HTML copies older
 * versions wrote next to the plans do not count). Used to suggest a folder of its own, e.g. SELENIUM_MCP_SPECS_DIR=test-plans.
 */
export async function otherContent(dir = getSpecsDir()): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const plans = new Set(await listPlans(dir));
  const ownHtml = (f: string) => f === 'index.html' || plans.has(f.replace(/\.html$/, '.md'));
  return entries.filter(f => !plans.has(f) && f.toLowerCase() !== 'readme.md' && !f.startsWith('.') && !ownHtml(f)).sort();
}

// Folders already warned about, shared by every copy of this module (a loader can load it twice).
const warned: Set<string> = ((globalThis as Record<string, unknown>).__seleniumAiAgentWarnedSpecs as Set<string> | undefined)
  ?? ((globalThis as Record<string, unknown>).__seleniumAiAgentWarnedSpecs = new Set<string>()) as Set<string>;

/**
 * A one-time note when the plans folder also holds other things (once per folder per process): the plans are
 * still saved and reviewed there, but a folder of their own keeps them apart.
 */
export async function sharedFolderNote(folder = getSpecsDir()): Promise<string> {
  const dir = path.resolve(folder);
  if (warned.has(dir)) return '';
  const other = await otherContent(dir);
  if (!other.length) return '';
  warned.add(dir);
  const examples = other.slice(0, 3).join(', ') + (other.length > 3 ? ', ...' : '');
  return `\nNote: ${dir} also holds other files (${examples}). Only test plans are listed for review and nothing else ` +
    'in it is changed. To keep the plans in a folder of their own, set SELENIUM_MCP_SPECS_DIR=test-plans (or start ' +
    'the server with --specs-dir=test-plans).';
}

/** Where a plan is shown relative to the project folder, e.g. "specs/login.md". */
function displayPath(file: string): string {
  const rel = path.relative(getOutputDir(), path.join(getSpecsDir(), file));
  return rel.startsWith('..') ? path.join(getSpecsDir(), file) : rel.split(path.sep).join('/');
}

/** Folder of the read-only review pages: <output>/.selenium-ai-agent/review/ (ignored by git). */
export function reviewPagesDir(): string {
  return path.join(getAgentFilesDir(), 'review');
}

/** The latest result per scenario of one plan ("1.2" → result), from the test runs. */
export async function scenarioResults(planFile: string): Promise<Record<string, ScenarioResult>> {
  const runs = await readTestRuns();
  const out: Record<string, ScenarioResult> = {};
  for (const [key, r] of Object.entries(runs.scenarios)) {
    const hash = key.lastIndexOf('#');
    if (key.slice(0, hash) === planFile) out[key.slice(hash + 1)] = { status: r.status, at: r.at, ...(r.message ? { message: r.message } : {}) };
  }
  return out;
}

/** The overview rows: every plan with the test files generated from it and their latest results. */
export async function overviewRows(): Promise<OverviewRow[]> {
  const manifest = await readManifest(getOutputDir());
  const runs = await readTestRuns();
  const rows: OverviewRow[] = [];
  for (const file of await listPlans()) {
    const markdown = await fs.readFile(path.join(getSpecsDir(), file), 'utf-8');
    const generated = (manifest?.tests ?? [])
      .filter(t => t.specFile && path.basename(t.specFile.endsWith('.md') ? t.specFile : `${t.specFile}.md`) === file)
      .map(t => t.file);
    const results = generated
      .map(f => ({ file: f, run: runs.files[path.resolve(f)] }))
      .filter(r => r.run)
      .map(r => ({ file: r.file, passed: r.run.passed, at: r.run.at }));
    rows.push({ file, markdown, generated, results, scenarios: await scenarioResults(file) });
  }
  return rows;
}

/**
 * Write the read-only copies to .selenium-ai-agent/review/: <plan>.html for every plan, and index.html. The folder
 * gets a .gitignore of its own, so the copies stay out of the repository; the plans themselves are the source.
 */
export async function writeStaticPages(): Promise<string> {
  const dir = reviewPagesDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(getAgentFilesDir(), '.gitignore'), '# Generated by selenium-ai-agent\n*\n');
  const rows = await overviewRows();
  for (const r of rows) {
    await fs.writeFile(path.join(dir, r.file.replace(/\.md$/, '.html')),
      renderPlanPage(r.markdown, { file: displayPath(r.file), overviewUrl: 'index.html', reviewRequired: planReviewRequired(), results: r.scenarios }));
  }
  const runs = await readTestRuns();
  const index = path.join(dir, 'index.html');
  await fs.writeFile(index, renderOverviewPage(rows, { dir: `${displayPath('')}/`, lastSuiteRun: runs.suite, reviewRequired: planReviewRequired() }));
  return index;
}

const url = (p: string, params: Record<string, string> = {}) =>
  `${base}${p}?${new URLSearchParams({ ...params, t: token }).toString()}`;

export const reviewUrls = {
  overview: () => url('/'),
  plan: (file: string) => url('/plan', { f: file }),
};

async function readBody(req: http.IncomingMessage): Promise<string> {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 200_000) throw new Error('too large');
  }
  return body;
}

function send(res: http.ServerResponse, status: number, type: string, body: string) {
  res.writeHead(status, {
    'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
  });
  res.end(body);
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
  const u = new URL(req.url ?? '/', base);
  if (u.searchParams.get('t') !== token) return send(res, 403, 'text/plain', 'Forbidden');

  if (req.method === 'GET' && u.pathname === '/') {
    const runs = await readTestRuns();
    const rows = await overviewRows();
    const elsewhere = rows.length ? [] : (await findPlanFolders()).filter(f => specsDirFor(f.dir) !== getSpecsDir());
    return send(res, 200, 'text/html; charset=utf-8', renderOverviewPage(rows, {
      dir: getSpecsDir(), planUrl: f => reviewUrls.plan(f), lastSuiteRun: runs.suite, reviewRequired: planReviewRequired(), elsewhere,
    }));
  }

  const file = planPath(u.searchParams.get('f'));
  if (!file) return send(res, 404, 'text/plain', 'No such plan');
  let markdown: string;
  try {
    markdown = await fs.readFile(file, 'utf-8');
  } catch {
    return send(res, 404, 'text/plain', 'No such plan');
  }
  const name = path.basename(file);
  // Only test plans: other Markdown in the same folder is not served or changed.
  if (!isPlanMarkdown(markdown)) return send(res, 404, 'text/plain', 'No such plan');

  if (req.method === 'GET' && u.pathname === '/plan') {
    return send(res, 200, 'text/html; charset=utf-8', renderPlanPage(markdown, {
      file: displayPath(name), decisionUrl: url('/plan/decision', { f: name }), overviewUrl: reviewUrls.overview(),
      reviewRequired: planReviewRequired(), results: await scenarioResults(name),
    }));
  }

  if (req.method === 'POST' && u.pathname === '/plan/decision') {
    // Only this page may post: a JSON body (no simple cross-site form post) from our own origin.
    if (!String(req.headers['content-type']).startsWith('application/json')) return send(res, 415, 'application/json', '{"error":"JSON only"}');
    const origin = req.headers.origin;
    if (origin && origin !== base) return send(res, 403, 'application/json', '{"error":"Forbidden"}');
    let body: { decision?: string; comments?: ReviewComment[]; general?: string };
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return send(res, 400, 'application/json', '{"error":"Bad request"}');
    }
    const comments = [
      ...(body.general?.trim() ? [{ text: body.general }] : []),
      ...(Array.isArray(body.comments) ? body.comments.filter(c => typeof c?.text === 'string').map(c => ({ test: String(c.test ?? ''), text: c.text })) : []),
    ].slice(0, 200);
    const when = now();
    let updated: string;
    let message: string;
    if (body.decision === 'approve') {
      updated = withPlanStatus(markdown, 'approved', `approved by the user in the review page on ${when} UTC`);
      message = 'Approved. Tell your AI assistant to continue: the generator can now write tests from this plan.';
    } else if (body.decision === 'changes') {
      if (!comments.length) return send(res, 400, 'application/json', '{"error":"Write what should change first."}');
      updated = withReviewComments(markdown, comments, when);
      message = 'Changes requested. Tell your AI assistant: the planner reads your comments, changes the plan and asks you again.';
    } else if (body.decision === 'reopen') {
      updated = withPlanStatus(markdown, 'draft', `reopened for review by the user on ${when} UTC: approve it again before more tests are generated`);
      message = 'Reopened for review. The plan is a draft again: the generator waits until you approve it.';
    } else {
      return send(res, 400, 'application/json', '{"error":"Unknown decision"}');
    }
    await fs.writeFile(file, updated);
    await writeStaticPages().catch(() => undefined);
    return send(res, 200, 'application/json', JSON.stringify({ message, status: planStatus(updated), pill: statusPill(planStatus(updated)) }));
  }

  return send(res, 404, 'text/plain', 'Not found');
}

/**
 * Start the review server once (on a free port on 127.0.0.1) and return its base URL.
 * keepAlive: keep the process running for it (the `review` command); inside the MCP server it lives as long as that.
 */
export async function ensureReviewServer(opts: { keepAlive?: boolean; port?: number } = {}): Promise<string> {
  if (server) return base;
  const s = http.createServer((req, res) => {
    handle(req, res).catch(err => send(res, 500, 'text/plain', err instanceof Error ? err.message : String(err)));
  });
  await new Promise<void>((resolve, reject) => {
    s.once('error', reject);
    s.listen(opts.port ?? 0, '127.0.0.1', () => resolve());
  });
  if (!opts.keepAlive) s.unref();
  const address = s.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  server = s;
  return base;
}

export async function stopReviewServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>(resolve => server!.close(() => resolve()));
  server = null;
  base = '';
}

/** Open a review page in the user's own default browser (not the browser the agent drives). */
export async function openInBrowser(target: string): Promise<boolean> {
  if (!/^http:\/\/127\.0\.0\.1:\d+\/[\w/?=&%.-]*$/.test(target)) return false;
  const { execFile } = await import('child_process');
  const [command, args] = process.platform === 'darwin' ? ['open', [target]]
    : process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', target]]
      : ['xdg-open', [target]];
  return new Promise(resolve => {
    // Opens our own review page (checked above: a 127.0.0.1 URL) in the default browser; no shell is involved.
    // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
    execFile(command, args, { timeout: 10000 }, err => resolve(!err));
  });
}

export const REVIEW_COMMAND = 'npx selenium-ai-agent review';

/**
 * Folders with test plans: the current output folder, the default one (~/selenium-ai-agent) and the project folders
 * in it. For "no plans here": tell the user where their plans are.
 */
export async function findPlanFolders(): Promise<Array<{ dir: string; plans: number }>> {
  const candidates = new Set<string>([getOutputDir(), defaultOutputDir()]);
  try {
    for (const e of await fs.readdir(defaultOutputDir(), { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith('.')) candidates.add(path.join(defaultOutputDir(), e.name));
    }
  } catch { /* no default folder */ }
  const found: Array<{ dir: string; plans: number }> = [];
  for (const dir of candidates) {
    const plans = (await listPlans(specsDirFor(dir))).length;
    if (plans) found.push({ dir, plans });
  }
  return found;
}
