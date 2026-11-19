import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PlannerSavePlanTool, PlannerSetupTool } from './planner.js';
import { GeneratorReadSpecTool } from './spec.js';

/** A fake browser: records what the planner does; one element with options for select. */
function fakeBrowser(missing: string[] = []) {
  const calls: string[] = [];
  let url = '';
  const element = (selector: string) => ({
    clear: async () => { calls.push(`clear ${selector}`); },
    sendKeys: async (v: string) => { calls.push(`type ${selector} ${v}`); },
    click: async () => { calls.push(`click ${selector}`); },
    findElements: async () => [{ getText: async () => 'Netherlands', click: async () => { calls.push(`option Netherlands`); } }],
  });
  const driver = {
    get: async (u: string) => { url = u; calls.push(`get ${u}`); },
    getCurrentUrl: async () => url,
    findElements: async () => [],
    switchTo: () => ({ activeElement: async () => element('active') }),
    wait: async (condition: { description?: () => string }, _t: number, message: string) => {
      const sel = message.replace(/^No element matches | is not visible$/g, '');
      if (missing.includes(sel)) throw new Error(message);
      return element(sel);
    },
  };
  const context = { ensureBrowser: async () => driver, getDriver: async () => driver, captureSnapshot: async () => undefined };
  return { context: context as never, calls };
}

describe('planner: seed test, setup steps and specs/', () => {
  let dir: string;
  const env = process.env.SELENIUM_MCP_OUTPUT_DIR;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-'));
    process.env.SELENIUM_MCP_OUTPUT_DIR = dir;
  });
  afterEach(() => {
    if (env === undefined) delete process.env.SELENIUM_MCP_OUTPUT_DIR;
    else process.env.SELENIUM_MCP_OUTPUT_DIR = env;
  });

  const parse = (r: { content: string }) => JSON.parse(r.content);

  it('runs setup steps (a login) in the browser before exploring', async () => {
    const { context, calls } = fakeBrowser();
    const res = parse(await new PlannerSetupTool().execute(context, {
      url: 'https://app.test/login', feature: 'Orders',
      setupSteps: [
        { action: 'fill', selector: '#email', value: 'tester@example.com' },
        { action: 'select', selector: '#country', value: 'Netherlands' },
        { action: 'click', selector: 'button[type=submit]' },
        { action: 'wait', selector: '.dashboard' },
      ],
    }));
    expect(calls).to.deep.equal([
      'get https://app.test/login', 'clear #email', 'type #email tester@example.com', 'option Netherlands', 'click button[type=submit]',
    ]);
    expect(res.ready).to.equal(true);
    expect(res.setupSteps.every((s: { ok: boolean }) => s.ok)).to.equal(true);
  });

  it('stops at a failing setup step and says which one', async () => {
    const { context } = fakeBrowser(['.dashboard']);
    const res = parse(await new PlannerSetupTool().execute(context, {
      url: 'https://app.test', feature: 'Orders',
      setupSteps: [{ action: 'click', selector: '#login' }, { action: 'wait', selector: '.dashboard' }],
    }));
    expect(res.ready).to.equal(false);
    expect(res.message).to.match(/Setup step 2 failed/);
  });

  it('returns the seed test as the template, from a file or from the manifest', async () => {
    fs.mkdirSync(path.join(dir, 'tests'));
    fs.writeFileSync(path.join(dir, 'tests', 'conftest.py'), 'def driver(): ...  # login fixture\n');
    const { context } = fakeBrowser();
    const byFile = parse(await new PlannerSetupTool().execute(context, { url: 'https://app.test', feature: 'F', seedTest: 'tests/conftest.py' }));
    expect(byFile.seedTest.content).to.contain('login fixture');

    fs.writeFileSync(path.join(dir, '.test-manifest.json'), JSON.stringify({
      version: 1, projectRoot: dir, baseUrl: '', framework: 'selenium-python-pytest', runCommand: { command: 'pytest', args: [] },
      configFile: null, tests: [], updatedAt: '', seedTests: [{ file: path.join(dir, 'tests', 'conftest.py'), framework: 'selenium-python-pytest' }],
    }));
    const byManifest = parse(await new PlannerSetupTool().execute(context, { url: 'https://app.test', feature: 'F' }));
    expect(byManifest.seedTest.framework).to.equal('selenium-python-pytest');
  });

  it('saves plans to specs/, where the generator finds them by name', async () => {
    const saved = await new PlannerSavePlanTool().execute({} as never, { planContent: '# Plan: cart', filename: 'shopping-cart.md' });
    expect(saved.content).to.contain(path.join(dir, 'specs', 'shopping-cart.md'));
    const read = parse(await new GeneratorReadSpecTool().execute({} as never, { specFile: 'shopping-cart' }));
    expect(read.content).to.equal('# Plan: cart');
  });
});
