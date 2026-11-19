import { z } from 'zod';

/**
 * A test plan in the same structure as Playwright's planner: suites with a seed file, tests
 * with the file they become, and steps that each carry their own expected results. On top
 * of that, Selenium AI Agent adds the elements found while exploring (with their locators)
 * and the gaps the planner noticed in the application.
 */
export const planStepSchema = z.object({
  perform: z.string().optional().describe('Action to perform, e.g. \'Click "Add to Cart" for the Mechanical Keyboard\''),
  expect: z.array(z.string()).describe('Expected results of this step, e.g. \'The cart button shows "1 items"\''),
});

export const planTestSchema = z.object({
  name: z.string().describe('Name of the test'),
  file: z.string().optional().describe('File the generated test is saved to, e.g. "tests/cart/test_add_from_grid.py"'),
  steps: z.array(planStepSchema).min(1),
});

export const planSuiteSchema = z.object({
  name: z.string().describe('Name of the suite (a feature or flow)'),
  seedFile: z.string().optional().describe('Seed test the suite starts from (setup, login, fixtures)'),
  tests: z.array(planTestSchema).min(1),
});

export const planElementSchema = z.object({
  name: z.string().describe('What the element is, e.g. "Search field"'),
  locator: z.string().describe('Stable locator, preferably the test id, e.g. "[data-testid=\\"search-input\\"]"'),
});

export const structuredPlanSchema = z.object({
  name: z.string().describe('Title of the plan, e.g. "Shopping cart and checkout"'),
  overview: z.string().describe('What the application or feature does, in a few sentences'),
  suites: z.array(planSuiteSchema).min(1),
  elements: z.array(planElementSchema).optional().describe('Elements found while exploring, with their locators'),
  gaps: z.array(z.string()).optional().describe('Things the application does not support or that need clarification'),
});

export type StructuredPlan = z.infer<typeof structuredPlanSchema>;

/** Text for a Markdown table cell: backslashes first, then the pipes that would end the cell, then line breaks. */
export function tableCell(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/**
 * A locator as a code span in a table cell. Backslashes stay as they are: inside a code span
 * they are literal (CSS.escape produces them, e.g. "#\31 23"). In a GFM table only "|" must be
 * escaped, even inside code: the table reads "\|" as "|", so "\|" in the input still shows
 * as "\|". Backticks would end the span and become quotes.
 */
export function codeCell(locator: string): string {
  return '`' + locator.replace(/`/g, "'").replace(/\r?\n/g, ' ').split('|').join('\\|') + '`';
}

/** Markdown in Playwright's planner layout, plus the elements and gaps sections. */
export function renderPlan(plan: StructuredPlan): string {
  const lines: string[] = [`# ${plan.name}`, '', '## Application Overview', '', plan.overview.trim()];

  if (plan.elements?.length) {
    lines.push('', '## Elements', '', '| Element | Locator |', '|---|---|');
    for (const e of plan.elements) {
      lines.push(`| ${tableCell(e.name)} | ${codeCell(e.locator)} |`);
    }
  }

  lines.push('', '## Test Scenarios');
  plan.suites.forEach((suite, i) => {
    lines.push('', `### ${i + 1}. ${suite.name}`);
    if (suite.seedFile) lines.push('', `**Seed:** \`${suite.seedFile}\``);
    suite.tests.forEach((test, j) => {
      lines.push('', `#### ${i + 1}.${j + 1}. ${test.name}`);
      if (test.file) lines.push('', `**File:** \`${test.file}\``);
      lines.push('', '**Steps:**');
      test.steps.forEach((step, k) => {
        lines.push(`  ${k + 1}. ${step.perform ?? '-'}`);
        for (const e of step.expect) lines.push(`    - expect: ${e}`);
      });
    });
  });

  if (plan.gaps?.length) {
    lines.push('', '## Gaps and Questions', '');
    for (const g of plan.gaps) lines.push(`- ${g}`);
  }

  const tests = plan.suites.reduce((n, s) => n + s.tests.length, 0);
  lines.push('', '---', '', `${plan.suites.length} suite(s), ${tests} test(s). Ready for the generator: \`generator_read_spec\`.`, '');
  return lines.join('\n');
}

/** "Shopping cart and checkout" → "shopping-cart-and-checkout.md" */
export function planFileName(name: string): string {
  const slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `${slug || 'test-plan'}.md`;
}
