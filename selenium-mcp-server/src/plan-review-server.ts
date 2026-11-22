/**
 * A small local web server for reviewing test plans in the browser: the overview of all plans and a review page per
 * plan, whose Approve and Request changes buttons write the decision into the plan's Markdown.
 *
 * It listens on 127.0.0.1 only, on a free port, and every request needs the random token in its URL, so other
 * sites and other users on the machine cannot read or change plans. It only reads and writes .md files directly in
 * the specs folder.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getOutputDir, getSpecsDir } from './utils/paths.js';
import { planReviewRequired, withPlanStatus, withReviewComments, planStatus, type ReviewComment } from './utils/plan-review.js';
import { renderOverviewPage, renderPlanPage, statusPill, type OverviewRow } from './plan-pages.js';
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

export async function listPlans(dir = getSpecsDir()): Promise<string[]> {
  try {
    return (await fs.readdir(dir)).filter(f => f.endsWith('.md') && f.toLowerCase() !== 'readme.md').sort();
  } catch {
    return [];
  }
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
    rows.push({ file, markdown, generated, results });
  }
  return rows;
}

/** Write the read-only copies: specs/<plan>.html for every plan, and specs/index.html. */
export async function writeStaticPages(): Promise<string> {
  const dir = getSpecsDir();
  await fs.mkdir(dir, { recursive: true });
  const rows = await overviewRows();
  for (const r of rows) {
    await fs.writeFile(path.join(dir, r.file.replace(/\.md$/, '.html')),
      renderPlanPage(r.markdown, { file: `specs/${r.file}`, overviewUrl: 'index.html', reviewRequired: planReviewRequired() }));
  }
  const runs = await readTestRuns();
  const index = path.join(dir, 'index.html');
  await fs.writeFile(index, renderOverviewPage(rows, { dir: 'specs/', lastSuiteRun: runs.suite, reviewRequired: planReviewRequired() }));
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
    return send(res, 200, 'text/html; charset=utf-8', renderOverviewPage(await overviewRows(), {
      dir: getSpecsDir(), planUrl: f => reviewUrls.plan(f), lastSuiteRun: runs.suite, reviewRequired: planReviewRequired(),
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

  if (req.method === 'GET' && u.pathname === '/plan') {
    return send(res, 200, 'text/html; charset=utf-8', renderPlanPage(markdown, {
      file: `specs/${name}`, decisionUrl: url('/plan/decision', { f: name }), overviewUrl: reviewUrls.overview(),
      reviewRequired: planReviewRequired(),
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
    } else {
      return send(res, 400, 'application/json', '{"error":"Unknown decision"}');
    }
    await fs.writeFile(file, updated);
    await writeStaticPages().catch(() => undefined);
    return send(res, 200, 'application/json', JSON.stringify({ message, status: planStatus(updated), pill: statusPill(planStatus(updated)) }));
  }

  return send(res, 404, 'text/plain', 'Not found');
}

/** Start the review server once (on a free port on 127.0.0.1) and return its base URL. */
export async function ensureReviewServer(): Promise<string> {
  if (server) return base;
  const s = http.createServer((req, res) => {
    handle(req, res).catch(err => send(res, 500, 'text/plain', err instanceof Error ? err.message : String(err)));
  });
  await new Promise<void>((resolve, reject) => {
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => resolve());
  });
  s.unref();
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
