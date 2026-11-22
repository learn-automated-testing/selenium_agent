import { expect } from 'chai';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parsePlan, renderOverviewPage, renderPlanPage } from './plan-pages.js';
import { renderPlan } from './utils/plan-format.js';
import { checkPlanApproved, planStatus, withPlanStatus, withReviewComments } from './utils/plan-review.js';
import { ensureReviewServer, overviewRows, reviewUrls, stopReviewServer, writeStaticPages } from './plan-review-server.js';
import { recordTestRun, readTestRuns, runSummary } from './utils/test-runs.js';
import { PlannerReviewPlanTool, PlannerSavePlanTool } from './tools/agents/planner.js';
import { GeneratorReadSpecTool } from './tools/agents/spec.js';

const STRUCTURED = renderPlan({
  name: 'Login',
  overview: 'Form authentication on the-internet.',
  elements: [{ name: 'Username', locator: '#username' }],
  suites: [{
    name: 'Login', seedFile: 'tests/conftest.py',
    tests: [
      { name: 'Valid login', file: 'tests/test_login.py', steps: [{ perform: 'Log in as tomsmith', expect: ['the secure area opens', 'a welcome message'] }] },
      { name: 'Wrong password', file: 'tests/test_login.py', steps: [{ perform: 'Log in with a wrong password', expect: ['an error'] }] },
    ],
  }],
  gaps: ['No test for a locked account'],
});

const HAND_WRITTEN = `# Test plan: the-internet.herokuapp.com

**Status:** approved — written and reviewed by hand.

Practice site.

## 1. Login

### 1.1 Valid login opens the secure area

1. Open \`/login\`
2. Enter username \`tomsmith\`, click Login
   - expect: the URL contains \`/secure\`
3. Click Logout
   - expect: the login page says "You logged out"

## 4. Dropdown (no test yet: let the generator write it)

### 4.1 Choose an option

1. Open \`/dropdown\`
   - expect: "Please select an option" is selected
`;

describe('plan review pages', () => {
  describe('parsePlan', () => {
    it('reads a plan from planner_save_plan', () => {
      const p = parsePlan(withPlanStatus(STRUCTURED, 'draft'));
      expect(p.title).to.equal('Login');
      expect(p.status).to.equal('draft');
      expect(p.suites).to.have.length(1);
      expect(p.suites[0].seed).to.equal('tests/conftest.py');
      expect(p.suites[0].tests.map(t => `${t.id} ${t.name}`)).to.deep.equal(['1.1 Valid login', '1.2 Wrong password']);
      expect(p.suites[0].tests[0].file).to.equal('tests/test_login.py');
      expect(p.suites[0].tests[0].steps).to.deep.equal([{ perform: 'Log in as tomsmith', expect: ['the secure area opens', 'a welcome message'] }]);
      expect(p.elements).to.deep.equal([{ name: 'Username', locator: '#username' }]);
      expect(p.gaps).to.deep.equal(['No test for a locked account']);
    });

    it('reads a hand-written plan like the samples', () => {
      const p = parsePlan(HAND_WRITTEN);
      expect(p.title).to.equal('the-internet.herokuapp.com');
      expect(p.status).to.equal('approved');
      expect(p.suites.map(s => s.name)).to.deep.equal(['Login', 'Dropdown']);
      expect(p.suites[0].tests[0].steps.map(s => s.perform)).to.deep.equal(['Open /login', 'Enter username tomsmith, click Login', 'Click Logout']);
      expect(p.suites[0].tests[0].steps[1].expect).to.deep.equal(['the URL contains /secure']);
      expect(p.suites[1].tests[0].id).to.equal('4.1');
    });

    it('reads the review comments', () => {
      const p = parsePlan(withReviewComments(STRUCTURED, [{ test: '1.2 Wrong password', text: 'Also check we stay on /login' }], '2026-11-22 14:30'));
      expect(p.status).to.equal('changes requested');
      expect(p.comments).to.deep.equal(['1.2 Wrong password: Also check we stay on /login']);
    });
  });

  describe('pages', () => {
    it('shows every test, step and expected result, escaped, with buttons only when it can save', () => {
      const md = withPlanStatus(STRUCTURED.replace('Log in as tomsmith', 'Log in as <tomsmith>'), 'draft');
      const page = renderPlanPage(md, { file: 'specs/login.md', decisionUrl: 'http://127.0.0.1:1/plan/decision?f=login.md&t=x' });
      expect(page).to.include('1.1 Valid login').and.include('the secure area opens').and.include('Draft, waiting for review');
      expect(page).to.include('Log in as &lt;tomsmith&gt;').and.not.include('<tomsmith>');
      expect(page).to.include('id="approve"').and.include('id="changes"').and.include('<textarea');
      const copy = renderPlanPage(md, { file: 'specs/login.md' });
      expect(copy).to.not.include('id="approve"');
      expect(copy).to.include('Read-only copy').and.include('npx selenium-ai-agent review');
    });

    it('overview counts plans per status and shows generated files and results', () => {
      const html = renderOverviewPage([
        { file: 'login.md', markdown: withPlanStatus(STRUCTURED, 'approved', 'approved by the user on 2026-11-22 14:30 UTC'), generated: ['tests/test_login.py'], results: [{ file: 'tests/test_login.py', passed: true, at: '' }] },
        { file: 'cart.md', markdown: withPlanStatus('# Cart', 'draft'), generated: [], results: [] },
      ], { dir: 'specs/' });
      expect(html).to.include('1 approved').and.include('1 to review').and.include('1 passed').and.include('none yet').and.include('2026-11-22');
      expect(html).to.include('href="login.html"');
    });
  });

  describe('the review switch', () => {
    const env = process.env.SELENIUM_MCP_PLAN_REVIEW;
    afterEach(() => { if (env === undefined) delete process.env.SELENIUM_MCP_PLAN_REVIEW; else process.env.SELENIUM_MCP_PLAN_REVIEW = env; });

    it('is on by default: drafts and plans with requested changes are refused', () => {
      delete process.env.SELENIUM_MCP_PLAN_REVIEW;
      expect(checkPlanApproved(withPlanStatus(STRUCTURED, 'draft'), 'x').ok).to.equal(false);
      const changes = checkPlanApproved(withReviewComments(STRUCTURED, [{ text: 'more' }], 'now'), 'x');
      expect(changes.ok).to.equal(false);
      expect(changes.message).to.include('asked for changes');
    });

    it('SELENIUM_MCP_PLAN_REVIEW=off lets the generator use any plan, and says so', () => {
      process.env.SELENIUM_MCP_PLAN_REVIEW = 'off';
      const r = checkPlanApproved(withPlanStatus(STRUCTURED, 'draft'), 'x');
      expect(r.ok).to.equal(true);
      expect(r.message).to.include('turned off');
    });
  });

  describe('test runs for the overview', () => {
    it('finds the result line of common runners', () => {
      expect(runSummary('...\n======= 4 passed in 3.21s =======\n')).to.equal('4 passed in 3.21s');
      expect(runSummary('Passed!  - Failed:     0, Passed:     7, Skipped:     0, Total:     7')).to.match(/^Passed!/);
      expect(runSummary('[INFO] Tests run: 7, Failures: 0, Errors: 0, Skipped: 0\n[INFO] BUILD SUCCESS')).to.equal('Tests run: 7, Failures: 0, Errors: 0, Skipped: 0');
      expect(runSummary('  7 passing (3s)')).to.equal('7 passing (3s)');
      expect(runSummary('nothing here')).to.equal('');
    });
  });

  describe('review server and tool', () => {
    let dir: string;
    const env = process.env.SELENIUM_MCP_OUTPUT_DIR;
    beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-')); process.env.SELENIUM_MCP_OUTPUT_DIR = dir; });
    afterEach(async () => { await stopReviewServer(); if (env === undefined) delete process.env.SELENIUM_MCP_OUTPUT_DIR; else process.env.SELENIUM_MCP_OUTPUT_DIR = env; });
    const save = () => new PlannerSavePlanTool().execute({} as never, { planContent: STRUCTURED, filename: 'login.md' });
    const md = () => fs.readFileSync(path.join(dir, 'specs', 'login.md'), 'utf8');
    const post = (url: string, body: unknown, headers: Record<string, string> = { 'Content-Type': 'application/json' }) =>
      fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const decisionUrl = async () => {
      const page = await (await fetch(reviewUrls.plan('login.md'))).text();
      return /fetch\("([^"]+)"/.exec(page)![1];
    };

    it('needs the token, and only serves plans in specs/', async () => {
      await save();
      const base = await ensureReviewServer();
      expect(base).to.match(/^http:\/\/127\.0\.0\.1:\d+$/);
      expect((await fetch(`${base}/`)).status).to.equal(403);
      expect((await fetch(reviewUrls.overview())).status).to.equal(200);
      expect((await fetch(reviewUrls.plan('login.md'))).status).to.equal(200);
      expect((await fetch(reviewUrls.plan('../secret.md'))).status).to.equal(404);
      expect((await fetch(reviewUrls.plan('login.txt'))).status).to.equal(404);
    });

    it('Approve writes the approval into the plan, and the generator may use it', async () => {
      await save();
      await ensureReviewServer();
      const r = await post(await decisionUrl(), { decision: 'approve' });
      expect(r.status).to.equal(200);
      expect(planStatus(md())).to.equal('approved');
      expect(md()).to.include('approved by the user in the review page on');
      expect((await new GeneratorReadSpecTool().execute({} as never, { specFile: 'login' })).isError).to.not.equal(true);
    });

    it('Request changes needs a comment and writes them into the plan; the generator refuses it', async () => {
      await save();
      await ensureReviewServer();
      const url = await decisionUrl();
      expect((await post(url, { decision: 'changes', comments: [] })).status).to.equal(400);
      expect(planStatus(md())).to.equal('draft');
      const r = await post(url, { decision: 'changes', comments: [{ test: '1.2 Wrong password', text: 'Also check we stay on /login' }], general: 'Add a locked account test' });
      expect(r.status).to.equal(200);
      expect(planStatus(md())).to.equal('changes requested');
      expect(md()).to.include('## Review comments').and.include('**1.2 Wrong password:** Also check we stay on /login').and.include('- Add a locked account test');
      const read = await new GeneratorReadSpecTool().execute({} as never, { specFile: 'login' });
      expect(read.isError).to.equal(true);
      expect(read.content).to.include('asked for changes');
    });

    it('Reopen for review puts an approved plan back to draft, and the generator waits again', async () => {
      await save();
      await ensureReviewServer();
      await post(await decisionUrl(), { decision: 'approve' });
      const page = await (await fetch(reviewUrls.plan('login.md'))).text();
      expect(page).to.include('id="reopen"').and.not.include('id="approve"');
      const r = await post(await decisionUrl(), { decision: 'reopen' });
      expect(r.status).to.equal(200);
      expect(planStatus(md())).to.equal('draft');
      expect(md()).to.include('reopened for review by the user on');
      expect((await new GeneratorReadSpecTool().execute({} as never, { specFile: 'login' })).isError).to.equal(true);
      const again = await (await fetch(reviewUrls.plan('login.md'))).text();
      expect(again).to.include('id="approve"').and.include('reopened for review');
      expect(again).to.not.include('id="reopen"');
    });

    it('refuses a decision that is not JSON or comes from another site', async () => {
      await save();
      await ensureReviewServer();
      const url = await decisionUrl();
      expect((await post(url, { decision: 'approve' }, { 'Content-Type': 'text/plain' })).status).to.equal(415);
      expect((await post(url, { decision: 'approve' }, { 'Content-Type': 'application/json', Origin: 'https://evil.example' })).status).to.equal(403);
      expect(planStatus(md())).to.equal('draft');
    });

    it('saving a plan writes the read-only copies, and the overview links generated tests and results', async () => {
      await save();
      expect(fs.existsSync(path.join(dir, 'specs', 'login.html'))).to.equal(true);
      expect(fs.readFileSync(path.join(dir, 'specs', 'index.html'), 'utf8')).to.include('Login');
      const testFile = path.join(dir, 'tests', 'test_login.py');
      fs.writeFileSync(path.join(dir, '.test-manifest.json'), JSON.stringify({
        version: 1, projectRoot: dir, baseUrl: '', framework: 'selenium-python-pytest', runCommand: null, configFile: null,
        tests: [{ file: testFile, framework: 'selenium-python-pytest', createdAt: '', specFile: 'login.md' }], updatedAt: '',
      }));
      await recordTestRun({ testPath: testFile, command: 'pytest tests/test_login.py', exitCode: 0, output: '1 passed in 1.0s' });
      await recordTestRun({ command: 'pytest', exitCode: 1, output: '== 6 passed, 1 failed in 9.1s ==' });
      const rows = await overviewRows();
      expect(rows[0].generated).to.deep.equal([testFile]);
      expect(rows[0].results.map(r => r.passed)).to.deep.equal([true]);
      expect((await readTestRuns()).suite?.summary).to.equal('6 passed, 1 failed in 9.1s');
      const index = await writeStaticPages();
      expect(fs.readFileSync(index, 'utf8')).to.include('1 passed').and.include('6 passed, 1 failed in 9.1s');
    });

    it('planner_review_plan gives the page and the plan status (without opening a browser in tests)', async () => {
      await save();
      const r = await new PlannerReviewPlanTool().execute({} as never, { specFile: 'login.md', open: false });
      expect(r.isError).to.not.equal(true);
      const j = JSON.parse(String(r.content));
      expect(j.status).to.equal('draft');
      expect(j.url).to.match(/^http:\/\/127\.0\.0\.1:\d+\/plan\?f=login\.md&t=[0-9a-f]+$/);
      const all = JSON.parse(String((await new PlannerReviewPlanTool().execute({} as never, { open: false })).content));
      expect(all.plans).to.deep.equal(['login.md']);
    });
  });
});
