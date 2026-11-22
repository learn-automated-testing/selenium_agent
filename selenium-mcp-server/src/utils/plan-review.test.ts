import { expect } from 'chai';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkPlanApproved, looksLikePlanPath, planStatus, withPlanStatus } from './plan-review.js';
import { PlannerApprovePlanTool, PlannerSavePlanTool } from '../tools/agents/planner.js';
import { GeneratorReadSpecTool, GeneratorSaveSpecTool } from '../tools/agents/spec.js';
import { GeneratorSetupTool, GeneratorWriteTestTool } from '../tools/agents/generator.js';

const ctx = () => ({
  generatorFramework: undefined as string | undefined,
  clearRecording: () => undefined,
  startRecording: () => undefined,
  captureSnapshot: async () => undefined,
  ensureBrowser: async () => ({ get: async () => undefined }),
}) as never;

const PLAN = '# Login\n\n## Test Scenarios\n\n### 1. Login\n\n#### 1.1. Valid login\n\n**Steps:**\n  1. Log in\n    - expect: the secure area\n';
const TEST = 'from selenium.webdriver.common.by import By\n\n\ndef test_login(driver):\n    driver.find_element(By.ID, "username").send_keys("tomsmith")\n';

describe('test plan review: tests are only generated from an approved plan', () => {
  describe('status line', () => {
    it('reads draft and approved in the usual spellings, and none when there is no line', () => {
      expect(planStatus('# P\n\n**Status:** draft — review it')).to.equal('draft');
      expect(planStatus('# P\nStatus: approved')).to.equal('approved');
      expect(planStatus('# P\n> **Status**: Approved by Ralph')).to.equal('approved');
      expect(planStatus('# P\n\nThe status: draft of the cart')).to.equal(null);
      expect(planStatus(PLAN)).to.equal(null);
    });

    it('puts the line under the title, replaces an existing one, and works without a title', () => {
      const draft = withPlanStatus(PLAN, 'draft');
      expect(draft.split('\n').slice(0, 3)).to.deep.equal(['# Login', '', draft.split('\n')[2]]);
      expect(planStatus(draft)).to.equal('draft');
      const approved = withPlanStatus(draft, 'approved', 'approved by the user: "ok"');
      expect(planStatus(approved)).to.equal('approved');
      expect(approved.match(/Status:/g)).to.have.length(1);
      expect(withPlanStatus('just steps', 'draft').startsWith('**Status:** draft')).to.equal(true);
    });

    it('refuses a draft unless the review is explicitly skipped, and notes a plan without a status', () => {
      expect(checkPlanApproved(withPlanStatus(PLAN, 'draft'), 'x.md').ok).to.equal(false);
      expect(checkPlanApproved(withPlanStatus(PLAN, 'draft'), 'x.md').message).to.include('planner_approve_plan');
      expect(checkPlanApproved(withPlanStatus(PLAN, 'draft'), 'x.md', true).ok).to.equal(true);
      expect(checkPlanApproved(withPlanStatus(PLAN, 'approved'), 'x.md')).to.deep.equal({ ok: true, status: 'approved' });
      const none = checkPlanApproved(PLAN, 'x.md');
      expect(none.ok).to.equal(true);
      expect(none.message).to.include('no review status');
    });

    it('tells a plan path from plan text', () => {
      expect(looksLikePlanPath('specs/login.md')).to.equal(true);
      expect(looksLikePlanPath('/home/me/specs/login.md')).to.equal(true);
      expect(looksLikePlanPath(PLAN)).to.equal(false);
      expect(looksLikePlanPath('Test the login page')).to.equal(false);
    });
  });

  describe('the tools', () => {
    let dir: string;
    const env = process.env.SELENIUM_MCP_OUTPUT_DIR;
    beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-review-')); process.env.SELENIUM_MCP_OUTPUT_DIR = dir; });
    afterEach(() => { if (env === undefined) delete process.env.SELENIUM_MCP_OUTPUT_DIR; else process.env.SELENIUM_MCP_OUTPUT_DIR = env; });
    const specPath = () => path.join(dir, 'specs', 'login.md');

    it('planner_save_plan saves every plan as a draft, also one that claims to be approved', async () => {
      const r = await new PlannerSavePlanTool().execute({} as never, { planContent: withPlanStatus(PLAN, 'approved'), filename: 'login.md' });
      expect(r.content).to.include('saved as a draft');
      expect(r.content).to.include('planner_approve_plan');
      expect(planStatus(fs.readFileSync(specPath(), 'utf8'))).to.equal('draft');
    });

    it('generator_save_spec saves a draft too', async () => {
      await new GeneratorSaveSpecTool().execute({} as never, { title: 'Login', content: PLAN });
      expect(planStatus(fs.readFileSync(specPath(), 'utf8'))).to.equal('draft');
    });

    it('planner_approve_plan records the user\'s words and the time', async () => {
      await new PlannerSavePlanTool().execute({} as never, { planContent: PLAN, filename: 'login.md' });
      const r = await new PlannerApprovePlanTool().execute({} as never, { specFile: 'login', approval: 'Looks good, generate the tests' });
      expect(r.isError).to.not.equal(true);
      const saved = fs.readFileSync(specPath(), 'utf8');
      expect(planStatus(saved)).to.equal('approved');
      expect(saved).to.match(/\*\*Status:\*\* approved — approved by the user on \d{4}-\d\d-\d\d \d\d:\d\d: "Looks good, generate the tests"/);
      expect(saved).to.include('#### 1.1. Valid login');
    });

    it('planner_approve_plan needs the user\'s words', async () => {
      await new PlannerSavePlanTool().execute({} as never, { planContent: PLAN, filename: 'login.md' });
      const r = await new PlannerApprovePlanTool().execute({} as never, { specFile: 'login', approval: '   ' });
      expect(r.isError).to.equal(true);
      expect(planStatus(fs.readFileSync(specPath(), 'utf8'))).to.equal('draft');
    });

    it('generator_setup_page refuses a draft plan, by path or as text, and starts from an approved one', async () => {
      await new PlannerSavePlanTool().execute({} as never, { planContent: PLAN, filename: 'login.md' });
      const byPath = await new GeneratorSetupTool().execute(ctx(), { url: 'https://app.test', testPlan: specPath(), framework: 'selenium-python-pytest' });
      expect(byPath.isError).to.equal(true);
      expect(byPath.content).to.include('is a draft');
      const byText = await new GeneratorSetupTool().execute(ctx(), {
        url: 'https://app.test', testPlan: fs.readFileSync(specPath(), 'utf8'), framework: 'selenium-python-pytest',
      });
      expect(byText.isError).to.equal(true);

      await new PlannerApprovePlanTool().execute({} as never, { specFile: 'login.md', approval: 'ok' });
      const ok = await new GeneratorSetupTool().execute(ctx(), { url: 'https://app.test', testPlan: 'specs/login.md', framework: 'selenium-python-pytest' });
      expect(ok.isError).to.not.equal(true);
      expect(String(ok.content)).to.include('"planStatus": "approved"');
    });

    it('generator_setup_page starts from a draft only when the review is explicitly skipped', async () => {
      await new PlannerSavePlanTool().execute({} as never, { planContent: PLAN, filename: 'login.md' });
      const r = await new GeneratorSetupTool().execute(ctx(), {
        url: 'https://app.test', testPlan: specPath(), framework: 'selenium-python-pytest', skipPlanReview: true,
      });
      expect(r.isError).to.not.equal(true);
      expect(String(r.content)).to.include('the review was skipped because the user asked for it');
    });

    it('generator_setup_page accepts a short request or a hand-written plan without a status', async () => {
      const r = await new GeneratorSetupTool().execute(ctx(), { url: 'https://app.test', testPlan: 'Test the login page', framework: 'selenium-python-pytest' });
      expect(r.isError).to.not.equal(true);
      expect(String(r.content)).to.include('"planStatus": "none"');
    });

    it('generator_read_spec refuses a draft and reads an approved plan', async () => {
      await new PlannerSavePlanTool().execute({} as never, { planContent: PLAN, filename: 'login.md' });
      expect((await new GeneratorReadSpecTool().execute({} as never, { specFile: 'login' })).isError).to.equal(true);
      expect((await new GeneratorReadSpecTool().execute({} as never, { specFile: 'login', skipPlanReview: true })).isError).to.not.equal(true);
      await new PlannerApprovePlanTool().execute({} as never, { specFile: 'login', approval: 'ok' });
      const r = await new GeneratorReadSpecTool().execute({} as never, { specFile: 'login' });
      expect(r.isError).to.not.equal(true);
      expect(String(r.content)).to.include('"planStatus": "approved"');
    });

    it('generator_write_test does not write a test for a draft plan', async () => {
      await new PlannerSavePlanTool().execute({} as never, { planContent: PLAN, filename: 'login.md' });
      const args = { testCode: TEST, filename: 'test_login.py', framework: 'selenium-python-pytest', verify: false, specFile: 'login.md' };
      const refused = await new GeneratorWriteTestTool().execute(ctx(), args);
      expect(refused.isError).to.equal(true);
      expect(refused.content).to.include('Test not written');
      expect(fs.existsSync(path.join(dir, 'tests', 'test_login.py'))).to.equal(false);

      await new PlannerApprovePlanTool().execute({} as never, { specFile: 'login.md', approval: 'go ahead' });
      const written = await new GeneratorWriteTestTool().execute(ctx(), args);
      expect(written.isError).to.not.equal(true);
      expect(fs.existsSync(path.join(dir, 'tests', 'test_login.py'))).to.equal(true);
    });
  });
});
