/**
 * HTML views of test plans, so a person can review a plan comfortably before tests are generated from it:
 * - a review page per plan: suites, tests, steps with their expected results, elements and gaps, with Approve and
 *   Request changes buttons (when served by the review server) and a comment box per test;
 * - an overview of every plan in specs/: review status, tests, generated test files and the last run.
 * The same pages are saved next to the plans (specs/<plan>.html, specs/index.html) as read-only copies.
 */
import { planStatus, type PlanStatus } from './utils/plan-review.js';

export interface PlanStep { perform: string; expect: string[] }
export interface PlanTest { id: string; name: string; file?: string; steps: PlanStep[] }
export interface PlanSuite { id: string; name: string; seed?: string; tests: PlanTest[] }
export interface ParsedPlan {
  title: string;
  status: PlanStatus | null;
  statusNote: string;
  overview: string;
  elements: Array<{ name: string; locator: string }>;
  suites: PlanSuite[];
  gaps: string[];
  comments: string[];
}

const strip = (s: string) => s.replace(/\*\*/g, '').replace(/`/g, '').trim();

/**
 * Read a plan written by planner_save_plan (### 1. Suite / #### 1.1. Test / numbered steps / - expect:) or by hand in
 * a similar shape (## 1. Suite / ### 1.1 Test). Anything it does not recognise is left out of the structure; the
 * page then also shows the plan text as it is.
 */
export function parsePlan(markdown: string): ParsedPlan {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const plan: ParsedPlan = {
    title: '', status: planStatus(markdown), statusNote: '', overview: '', elements: [], suites: [], gaps: [], comments: [],
  };
  let section = '';
  let suite: PlanSuite | undefined;
  let test: PlanTest | undefined;
  let step: PlanStep | undefined;
  const overview: string[] = [];

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const status = /^\s*(?:>\s*)?\*{0,2}Status:?\*{0,2}\s*:?\s*\*{0,2}(?:draft|approved|changes requested)\b(.*)$/i.exec(line);
    if (status) { plan.statusNote = status[1].replace(/^\s*[—-]\s*/, '').trim(); continue; }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      if (level === 1 && !plan.title) { plan.title = text.replace(/^Test plan:\s*/i, ''); continue; }
      const testHead = /^(\d+\.\d+)\.?\s+(.*)$/.exec(text);
      const suiteHead = /^(\d+)\.\s+(.*)$/.exec(text);
      if (testHead && level >= 3) {
        test = { id: testHead[1], name: testHead[2].trim(), steps: [] };
        step = undefined;
        if (!suite) { suite = { id: testHead[1].split('.')[0], name: '', tests: [] }; plan.suites.push(suite); }
        suite.tests.push(test);
        section = 'scenarios';
        continue;
      }
      if (suiteHead && level >= 2 && level <= 3) {
        suite = { id: suiteHead[1], name: suiteHead[2].replace(/\s*\(.*\)\s*$/, '').trim(), tests: [] };
        plan.suites.push(suite);
        test = undefined; step = undefined; section = 'scenarios';
        continue;
      }
      const lower = text.toLowerCase();
      section = lower.includes('overview') ? 'overview'
        : lower.includes('element') ? 'elements'
          : lower.includes('gap') || lower.includes('question') ? 'gaps'
            : lower.includes('review comment') ? 'comments'
              : lower.includes('scenario') ? 'scenarios' : section;
      test = section === 'scenarios' ? test : undefined;
      continue;
    }

    if (section === 'elements') {
      const row = /^\|(.+)\|(.+)\|\s*$/.exec(line);
      if (row && !/^\s*-+\s*$/.test(row[1]) && strip(row[1]).toLowerCase() !== 'element') {
        plan.elements.push({ name: strip(row[1]), locator: strip(row[2]) });
      }
      continue;
    }
    if (section === 'gaps' || section === 'comments') {
      const item = /^\s*[-*]\s+(.*)$/.exec(line);
      if (item) (section === 'gaps' ? plan.gaps : plan.comments).push(strip(item[1]));
      continue;
    }
    const seed = /\*\*Seed:\*\*\s*(.*)$/.exec(line);
    if (seed && suite) { suite.seed = strip(seed[1]); continue; }
    const file = /\*\*File:\*\*\s*(.*)$/.exec(line);
    if (file && test) { test.file = strip(file[1]); continue; }
    if (test) {
      const expect = /^\s*[-*]\s*expect:\s*(.*)$/i.exec(line);
      if (expect) {
        if (!step) { step = { perform: '', expect: [] }; test.steps.push(step); }
        step.expect.push(strip(expect[1]));
        continue;
      }
      const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);
      if (numbered) { step = { perform: strip(numbered[1]), expect: [] }; test.steps.push(step); continue; }
      continue;
    }
    if (!plan.suites.length && line.trim() && section !== 'scenarios') overview.push(line.trim());
  }
  plan.overview = overview.join(' ').replace(/\s+/g, ' ').trim();
  return plan;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLE = `
:root{--bg:#f6f7f9;--card:#fff;--text:#1c1f24;--muted:#5d6572;--line:#e3e6eb;--accent:#2f5bd3;--ok:#16794a;--ok-bg:#e6f4ec;
--warn:#8a5a00;--warn-bg:#fdf3dc;--bad:#b42318;--bad-bg:#fdecea;--on-ok:#fff;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#121417;--card:#1b1e23;--text:#e7e9ed;--muted:#9aa3af;--line:#2c3138;--accent:#8aa8ff;
--ok:#6fd3a0;--ok-bg:#16302a;--warn:#f1c46b;--warn-bg:#352a12;--bad:#f59a90;--bad-bg:#3a1d1a;--on-ok:#0b2a1c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif}
main{max-width:980px;margin:0 auto;padding:28px 20px 80px}a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}.path{font:12px var(--mono);color:var(--muted)}
h1{font-size:26px;margin:2px 0 4px;font-weight:600}h2{font-size:17px;margin:26px 0 10px;font-weight:600}
.pill{display:inline-block;font-size:13px;padding:4px 12px;border-radius:999px;white-space:nowrap}
.s-approved{background:var(--ok-bg);color:var(--ok)}.s-draft,.s-none{background:var(--warn-bg);color:var(--warn)}.s-changes{background:var(--bad-bg);color:var(--bad)}
.note{color:var(--muted);font-size:13px;margin-top:6px}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:18px 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px}.stat b{display:block;font-size:22px}.stat span{color:var(--muted);font-size:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-bottom:12px}
.suite{font-weight:600;margin:22px 0 8px}.suite small{color:var(--muted);font-weight:400;font-family:var(--mono);margin-left:8px}
.test-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.test-head b{font-weight:600}.file{font:12px var(--mono);color:var(--muted)}
ol{margin:10px 0 0;padding-left:22px}li{margin:4px 0}ul{margin:4px 0 6px;padding-left:4px}.exp{color:var(--ok);list-style:none}.exp::before{content:"✓  ";font-weight:700}
textarea{width:100%;min-height:38px;margin-top:10px;font:14px inherit;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--text);resize:vertical}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:500;font-size:12px}
td code,.mono{font:13px var(--mono)}.gap{background:var(--warn-bg);color:var(--warn);border-radius:8px;padding:8px 12px;margin:6px 0}
.comment{background:var(--bad-bg);color:var(--bad);border-radius:8px;padding:8px 12px;margin:6px 0}
.bar{position:sticky;bottom:0;background:var(--card);border-top:1px solid var(--line);padding:14px 20px;display:flex;gap:10px;justify-content:flex-end;align-items:center;flex-wrap:wrap}
button{font:600 14px inherit;padding:9px 18px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--text);cursor:pointer}
button.primary{background:var(--ok);border-color:var(--ok);color:var(--on-ok)}button:disabled{opacity:.55;cursor:default}
#msg{margin-right:auto;color:var(--muted);font-size:14px}.err{color:var(--bad)!important}pre{white-space:pre-wrap;font:13px var(--mono)}
.muted{color:var(--muted)}.ok{color:var(--ok)}.bad{color:var(--bad)}`;

function statusPill(status: PlanStatus | null): string {
  const label = status === 'approved' ? 'Approved' : status === 'changes requested' ? 'Changes requested' : status === 'draft' ? 'Draft, waiting for review' : 'No review status';
  const cls = status === 'approved' ? 's-approved' : status === 'changes requested' ? 's-changes' : status === 'draft' ? 's-draft' : 's-none';
  return `<span class="pill ${cls}">${label}</span>`;
}

export interface PlanPageOptions {
  /** Path shown at the top, e.g. specs/login.md */
  file: string;
  /** Where the buttons send the decision; without it the page is read-only. */
  decisionUrl?: string;
  overviewUrl?: string;
  reviewRequired?: boolean;
}

export function renderPlanPage(markdown: string, opts: PlanPageOptions): string {
  const plan = parsePlan(markdown);
  const tests = plan.suites.flatMap(s => s.tests);
  const steps = tests.reduce((n, t) => n + t.steps.length, 0);
  const expects = tests.reduce((n, t) => n + t.steps.reduce((m, s) => m + s.expect.length, 0), 0);
  const interactive = Boolean(opts.decisionUrl);
  const testCard = (t: PlanTest) => `
<div class="card" data-test="${esc(`${t.id} ${t.name}`)}">
  <div class="test-head"><b>${esc(t.id)} ${esc(t.name)}</b>${t.file ? `<span class="file">${esc(t.file)}</span>` : ''}</div>
  <ol>${t.steps.map(s => `<li>${s.perform ? esc(s.perform) : '<span class="muted">(no action)</span>'}${s.expect.length ? `<ul>${s.expect.map(e => `<li class="exp">${esc(e)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ol>
  ${interactive ? '<textarea placeholder="Comment on this test (optional)"></textarea>' : ''}
</div>`;
  const body = plan.suites.length
    ? plan.suites.map(s => `<div class="suite">${esc(s.id)}. ${esc(s.name || 'Tests')}${s.seed ? `<small>seed: ${esc(s.seed)}</small>` : ''}</div>${s.tests.map(testCard).join('')}`).join('')
    : `<div class="card"><pre>${esc(markdown)}</pre></div>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(plan.title || opts.file)} · test plan review</title><style>${STYLE}</style></head><body><main>
<div class="top"><div><div class="path">${opts.overviewUrl ? `<a href="${esc(opts.overviewUrl)}">All test plans</a> · ` : ''}${esc(opts.file)}</div>
<h1>${esc(plan.title || opts.file)}</h1></div><div id="status">${statusPill(plan.status)}</div></div>
${plan.statusNote && plan.status !== 'draft' ? `<div class="note">${esc(plan.statusNote)}</div>` : ''}
<div class="stats"><div class="stat"><b>${plan.suites.length}</b><span>suites</span></div><div class="stat"><b>${tests.length}</b><span>tests</span></div>
<div class="stat"><b>${steps}</b><span>steps</span></div><div class="stat"><b>${expects}</b><span>expected results</span></div>
<div class="stat"><b class="${plan.gaps.length ? 'bad' : ''}">${plan.gaps.length}</b><span>gaps and questions</span></div></div>
${plan.overview ? `<p class="muted">${esc(plan.overview)}</p>` : ''}
${plan.comments.length ? `<h2>Review comments</h2>${plan.comments.map(c => `<div class="comment">${esc(c)}</div>`).join('')}` : ''}
<h2>Test scenarios</h2>${body}
${plan.elements.length ? `<h2>Elements</h2><div class="card"><table><tr><th>Element</th><th>Locator</th></tr>${plan.elements.map(e => `<tr><td>${esc(e.name)}</td><td><code>${esc(e.locator)}</code></td></tr>`).join('')}</table></div>` : ''}
${plan.gaps.length ? `<h2>Gaps and questions</h2>${plan.gaps.map(g => `<div class="gap">${esc(g)}</div>`).join('')}` : ''}
${interactive ? '<h2>Comment on the whole plan</h2><textarea id="general" placeholder="Anything missing, out of scope or wrong? (optional)"></textarea>' : ''}
</main>
${interactive ? `<div class="bar"><span id="msg">${opts.reviewRequired === false ? 'The plan review is turned off: approving is optional.' : 'Tests are only generated from an approved plan.'}</span>
<button id="changes">Request changes</button><button id="approve" class="primary">Approve plan</button></div>
<script>
const send = async (decision) => {
  const comments = [...document.querySelectorAll('[data-test]')].map(c => ({ test: c.dataset.test, text: c.querySelector('textarea').value.trim() })).filter(c => c.text);
  const general = document.getElementById('general').value.trim();
  const msg = document.getElementById('msg');
  if (decision === 'changes' && !comments.length && !general) { msg.textContent = 'Write what should change first, on a test or on the whole plan.'; msg.className = 'err'; return; }
  document.querySelectorAll('.bar button').forEach(b => b.disabled = true);
  try {
    const r = await fetch(${JSON.stringify(opts.decisionUrl)}, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, comments, general }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.statusText);
    msg.className = ''; msg.textContent = j.message;
    document.getElementById('status').innerHTML = j.pill;
  } catch (e) { msg.className = 'err'; msg.textContent = 'Not saved: ' + e.message; document.querySelectorAll('.bar button').forEach(b => b.disabled = false); }
};
document.getElementById('approve').onclick = () => send('approve');
document.getElementById('changes').onclick = () => send('changes');
</script>` : `<div class="bar"><span id="msg">Read-only copy. To approve or request changes, ask your AI assistant to open the review page (planner_review_plan).</span></div>`}
</body></html>`;
}

export { statusPill };

export interface OverviewRow {
  /** File name in specs/, e.g. login.md */
  file: string;
  markdown: string;
  /** Generated test files linked to this plan (from .test-manifest.json). */
  generated: string[];
  /** Latest result per generated file, when the healer ran it. */
  results: Array<{ file: string; passed: boolean; at: string }>;
}

export interface OverviewOptions {
  dir: string;
  planUrl?: (file: string) => string;
  lastSuiteRun?: { at: string; passed: boolean; summary: string; command: string } | null;
  reviewRequired?: boolean;
}

const day = (iso: string) => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : '';

export function renderOverviewPage(rows: OverviewRow[], opts: OverviewOptions): string {
  const parsed = rows.map(r => ({ ...r, plan: parsePlan(r.markdown) }));
  const count = (st: PlanStatus | null) => parsed.filter(r => r.plan.status === st).length;
  const body = parsed.map(r => {
    const tests = r.plan.suites.reduce((n, s) => n + s.tests.length, 0);
    const passed = r.results.filter(x => x.passed).length;
    const failed = r.results.length - passed;
    const last = r.results.length
      ? `<span class="${failed ? 'bad' : 'ok'}">${passed} passed${failed ? `, ${failed} failed` : ''}</span>`
      : '<span class="muted">not run yet</span>';
    const href = opts.planUrl ? opts.planUrl(r.file) : r.file.replace(/\.md$/, '.html');
    const when = /on (\d{4}-\d\d-\d\d)/.exec(r.plan.statusNote)?.[1];
    return `<tr><td><a href="${esc(href)}">${esc(r.plan.title || r.file)}</a><div class="file">${esc(r.file)}</div></td>
<td>${statusPill(r.plan.status)}${when ? `<div class="note">${esc(when)}</div>` : ''}</td><td>${tests}</td>
<td>${r.generated.length ? `${r.generated.length}` : '<span class="muted">none yet</span>'}</td><td>${last}</td></tr>`;
  }).join('');
  const run = opts.lastSuiteRun;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test plans</title><style>${STYLE}</style></head><body><main>
<div class="top"><div><div class="path">${esc(opts.dir)}</div><h1>Test plans</h1></div>
<div>${count('approved') ? `<span class="pill s-approved">${count('approved')} approved</span> ` : ''}${count('draft') ? `<span class="pill s-draft">${count('draft')} to review</span> ` : ''}${count('changes requested') ? `<span class="pill s-changes">${count('changes requested')} changes requested</span> ` : ''}${count(null) ? `<span class="pill s-none">${count(null)} without status</span>` : ''}</div></div>
<div class="note">${opts.reviewRequired === false ? 'The plan review is turned off (SELENIUM_MCP_PLAN_REVIEW=off): tests may be generated from any plan.' : 'Tests are only generated from approved plans.'}${run ? ` Last test run: <span class="${run.passed ? 'ok' : 'bad'}">${esc(run.summary || (run.passed ? 'passed' : 'failed'))}</span>, ${esc(day(run.at))}.` : ''}</div>
<div class="card" style="margin-top:16px;padding:6px 8px">${parsed.length
    ? `<table><tr><th>Plan</th><th>Review</th><th>Tests</th><th>Generated</th><th>Last run</th></tr>${body}</table>`
    : '<p class="muted" style="padding:10px">No test plans yet. Ask the planner to explore your app and save a plan.</p>'}</div>
</main></body></html>`;
}
