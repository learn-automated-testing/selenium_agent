import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { codeCell, planFileName, renderPlan, tableCell, type StructuredPlan } from './plan-format.js';
import { PlannerSavePlanTool } from '../tools/agents/planner.js';

const PLAN: StructuredPlan = {
  name: 'Shopping cart and checkout',
  overview: 'A web shop with 10 products; the cart button opens the checkout.',
  elements: [{ name: 'Cart button', locator: '[data-testid="cart-button"]' }],
  suites: [{
    name: 'Cart',
    seedFile: 'tests/seed_test.py',
    tests: [{
      name: 'Add a product from the grid',
      file: 'tests/cart/test_add_from_grid.py',
      steps: [
        { perform: 'Open the shop', expect: ['10 products are listed'] },
        { perform: 'Click "Add to Cart" for the Mechanical Keyboard', expect: ['The cart button shows "1 items"', 'The total is "$89.99"'] },
      ],
    }],
  }],
  gaps: ['There is no way to change quantities in the cart.'],
};

describe('structured test plans (Playwright layout)', () => {
  it('renders suites, seed, target file and an expect list per step, like Playwright', () => {
    const md = renderPlan(PLAN);
    expect(md).to.contain('# Shopping cart and checkout\n\n## Application Overview');
    expect(md).to.contain('### 1. Cart\n\n**Seed:** `tests/seed_test.py`');
    expect(md).to.contain('#### 1.1. Add a product from the grid\n\n**File:** `tests/cart/test_add_from_grid.py`');
    expect(md).to.contain('  2. Click "Add to Cart" for the Mechanical Keyboard\n    - expect: The cart button shows "1 items"\n    - expect: The total is "$89.99"');
  });

  it('adds the elements table and the gaps that Playwright plans do not have', () => {
    const md = renderPlan(PLAN);
    expect(md).to.contain('| Cart button | `[data-testid="cart-button"]` |');
    expect(md).to.contain('## Gaps and Questions\n\n- There is no way to change quantities in the cart.');
  });

  it('escapes backslashes, pipes and line breaks in table cells', () => {
    expect(tableCell('a|b')).to.equal('a\\|b');
    expect(tableCell('ends with \\')).to.equal('ends with \\\\');
    expect(tableCell('C:\\x|y')).to.equal('C:\\\\x\\|y');
    expect(tableCell('two\nlines')).to.equal('two lines');
  });

  it('keeps locator backslashes and escapes only pipes in code cells', () => {
    expect(codeCell('#\\31 23')).to.equal('`#\\31 23`');
    expect(codeCell('[title="a|b"]')).to.equal('`[title="a\\|b"]`');
    expect(codeCell('a`b')).to.equal("`a'b`");
  });

  it('names the file after the plan', () => {
    expect(planFileName('Shopping cart and checkout')).to.equal('shopping-cart-and-checkout.md');
    expect(planFileName('***')).to.equal('test-plan.md');
  });

  describe('planner_save_plan', () => {
    let dir: string;
    const env = process.env.SELENIUM_MCP_OUTPUT_DIR;
    beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-')); process.env.SELENIUM_MCP_OUTPUT_DIR = dir; });
    afterEach(() => { if (env === undefined) delete process.env.SELENIUM_MCP_OUTPUT_DIR; else process.env.SELENIUM_MCP_OUTPUT_DIR = env; });

    it('saves a structured plan to specs/<plan-name>.md and reports its size', async () => {
      const res = await new PlannerSavePlanTool().execute({} as never, PLAN);
      expect(res.isError).to.not.equal(true);
      expect(res.content).to.contain('1 suite(s), 1 test(s), 2 steps.');
      const saved = fs.readFileSync(path.join(dir, 'specs', 'shopping-cart-and-checkout.md'), 'utf8');
      expect(saved).to.equal(renderPlan(PLAN));
    });

    it('still accepts a free-form plan', async () => {
      await new PlannerSavePlanTool().execute({} as never, { planContent: '# Plan', filename: 'free.md' });
      expect(fs.readFileSync(path.join(dir, 'specs', 'free.md'), 'utf8')).to.equal('# Plan');
    });

    it('explains what is missing in an incomplete structured plan', async () => {
      const res = await new PlannerSavePlanTool().execute({} as never, { suites: PLAN.suites });
      expect(res.isError).to.equal(true);
      expect(res.content).to.match(/Incomplete plan: name/);
    });
  });
});
