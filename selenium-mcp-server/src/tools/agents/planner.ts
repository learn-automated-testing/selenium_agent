import { z } from 'zod';
import { By } from 'selenium-webdriver';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { getOutputDir, getSpecsDir, resolveOutputDir } from '../../utils/paths.js';
import { readManifest } from '../../types/manifest.js';
import { runSetupSteps, setupStepSchema } from '../../utils/setup-steps.js';
import { planFileName, renderPlan, structuredPlanSchema } from '../../utils/plan-format.js';
import { validateOutputPath } from '../../utils/sandbox.js';
import { getPageInventory } from '../../utils/page-inventory.js';
import { planReviewRequired, planStatus, withPlanStatus } from '../../utils/plan-review.js';
import { findSpec } from './spec.js';

// Planner Setup Tool
const setupSchema = z.object({
  url: z.string().describe('URL of the web application to test'),
  feature: z.string().describe('Name of the feature to create test plan for'),
  explorationDepth: z.enum(['quick', 'single_page', 'section', 'full_site']).optional().default('quick')
    .describe('Depth of exploration'),
  seedTest: z.string().optional()
    .describe('Seed test file (fixtures, base URL, login helpers). Its content is returned as the template generated tests follow. Default: the seed registered with generator_write_seed, if any'),
  setupSteps: z.array(setupStepSchema).optional()
    .describe('Steps to run in the browser before exploring, e.g. a login: [{action:"fill",selector:"#email",value:"..."},{action:"click",selector:"button[type=submit]"},{action:"wait",selector:".dashboard"}]'),
});

const SEED_PREVIEW_CHARS = 6000;

/** The seed to plan with: the given file, else the first one registered in the test manifest. */
async function loadSeed(seedTest: string | undefined): Promise<{ file: string; framework?: string; content: string } | undefined> {
  const fs = await import('fs/promises');
  const path = await import('path');
  let file = seedTest ? resolveOutputDir(seedTest, '') : undefined;
  let framework: string | undefined;
  if (!file) {
    const manifest = await readManifest(getOutputDir());
    const seed = manifest?.seedTests?.[0];
    if (!seed) return undefined;
    file = seed.file;
    framework = seed.framework;
  }
  const candidates = path.isAbsolute(seedTest ?? '') || !seedTest ? [file] : [file, path.resolve(seedTest)];
  for (const candidate of candidates) {
    try {
      const content = await fs.readFile(candidate, 'utf-8');
      return { file: candidate, ...(framework ? { framework } : {}), content: content.slice(0, SEED_PREVIEW_CHARS) };
    } catch {
      continue;
    }
  }
  throw new Error(`Seed test not found: ${seedTest ?? file}`);
}

export class PlannerSetupTool extends BaseTool {
  readonly name = 'planner_setup_page';
  readonly description =
    'Start test planning: open the application, optionally run setup steps (e.g. a login) in the browser, ' +
    'and load the seed test that generated tests will follow. Call once, before other planner tools';
  readonly inputSchema = setupSchema;
  readonly category: ToolCategory = 'agent';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { url, feature, explorationDepth, seedTest, setupSteps } = this.parseParams(setupSchema, params);

    let seed: Awaited<ReturnType<typeof loadSeed>>;
    try {
      seed = await loadSeed(seedTest);
    } catch (err) {
      return this.error(err instanceof Error ? err.message : String(err));
    }

    const driver = await context.ensureBrowser();
    await driver.get(url);

    const setup = setupSteps?.length ? await runSetupSteps(driver, setupSteps) : [];
    const setupFailed = setup.find(r => !r.ok);
    await context.captureSnapshot();

    // Discover navigation links
    const navLinks = await this.discoverNavigationLinks(driver);

    const result = {
      message: setupFailed
        ? `Setup step ${setupFailed.step} failed: ${setupFailed.error}. Fix the step (selector, timing) and call planner_setup_page again.`
        : `Planning session initialized for '${feature}'`,
      url: await driver.getCurrentUrl(),
      explorationDepth,
      ...(setup.length ? { setupSteps: setup } : {}),
      ...(seed
        ? {
            seedTest: {
              ...seed,
              note: 'Write the plan so tests can start from this seed: same fixtures, base URL and login. Mention the seed file in the plan.',
            },
          }
        : {}),
      plansFolder: getSpecsDir(),
      navigationLinks: navLinks,
      ready: !setupFailed,
    };

    return this.success(JSON.stringify(result, null, 2), true);
  }

  private async discoverNavigationLinks(driver: any): Promise<Array<{ text: string; href: string }>> {
    const links: Array<{ text: string; href: string }> = [];
    const selectors = ['nav a', 'header a', '[role="navigation"] a', '.nav a', '.menu a'];

    for (const selector of selectors) {
      try {
        const elements = await driver.findElements(By.css(selector));
        for (const el of elements.slice(0, 10)) {
          try {
            const href = await el.getAttribute('href');
            const text = await el.getText();
            if (href && text && text.trim()) {
              links.push({ text: text.trim(), href });
            }
          } catch { continue; }
        }
      } catch { continue; }
    }

    // Remove duplicates
    const seen = new Set<string>();
    return links.filter(link => {
      const key = `${link.text}|${link.href}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

// Planner Explore Page Tool
const exploreSchema = z.object({
  pageUrl: z.string().optional().describe('URL to explore (uses current page if not specified)'),
  pageName: z.string().describe('Name of the page/section being explored')
});

export class PlannerExplorePageTool extends BaseTool {
  readonly name = 'planner_explore_page';
  readonly description =
    'Explore a page in detail: headings, input fields (with their labels, test ids and dropdown options), ' +
    'buttons, links and forms, as a compact inventory for writing test cases';
  readonly inputSchema = exploreSchema;
  readonly category: ToolCategory = 'agent';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { pageUrl, pageName } = this.parseParams(exploreSchema, params);

    const driver = pageUrl ? await context.ensureBrowser() : await context.getDriver();
    if (pageUrl) {
      await driver.get(pageUrl);
    }

    await context.captureSnapshot();
    const inventory = await getPageInventory(driver);

    const result = {
      message:
        `${inventory.scope === 'dialog' ? 'Pop-up on ' : ''}Page '${pageName}' explored: ${inventory.totals.fields} fields, ` +
        `${inventory.totals.buttons} buttons, ${inventory.totals.links} links, ${inventory.forms.length} forms` +
        (inventory.totals.inShadowDom
          ? `; ${inventory.totals.inShadowDom} of them inside web components (shadow DOM): get their locators with browser_generate_locator`
          : ''),
      url: await driver.getCurrentUrl(),
      title: await driver.getTitle(),
      ...inventory,
    };

    return this.success(JSON.stringify(result, null, 2), true);
  }
}

// Planner Save Plan Tool
const savePlanSchema = structuredPlanSchema.partial().extend({
  planContent: z.string().optional()
    .describe('Free-form markdown plan. Prefer the structured fields (name, overview, suites), which give every plan the same layout'),
  filename: z.string().optional().describe('File name (default: from the plan name, e.g. shopping-cart-and-checkout.md)'),
  outputDir: z.string().optional().describe('Folder for the plan (default: specs/, where the generator reads plans)')
});

export class PlannerSavePlanTool extends BaseTool {
  readonly name = 'planner_save_plan';
  readonly description =
    'Save the test plan to specs/. Give it structured, as in Playwright: name, overview, suites (name, seedFile) with ' +
    'tests (name, target file) and steps (perform + expect per step); add the elements you found (name + locator) ' +
    'and any gaps. It is written as Markdown in a fixed layout. Free-form planContent is still accepted.\n\n' +
    'Every saved plan is a draft ("Status: draft"): show it to the user and wait for their review. The generator ' +
    'refuses a draft plan; when the user approves it, call planner_approve_plan with their words.';
  readonly inputSchema = savePlanSchema;
  readonly category: ToolCategory = 'agent';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const parsed = this.parseParams(savePlanSchema, params);
    const { planContent, filename, outputDir } = parsed;

    let content: string;
    let summary = '';
    if (parsed.suites?.length) {
      const structured = structuredPlanSchema.safeParse(parsed);
      if (!structured.success) {
        return this.error(`Incomplete plan: ${structured.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      }
      content = renderPlan(structured.data);
      const tests = structured.data.suites.reduce((n, s) => n + s.tests.length, 0);
      const steps = structured.data.suites.reduce((n, s) => n + s.tests.reduce((m, t) => m + t.steps.length, 0), 0);
      summary = `\n${structured.data.suites.length} suite(s), ${tests} test(s), ${steps} steps.`;
    } else if (planContent) {
      content = planContent;
    } else {
      return this.error('Give the plan as name, overview and suites (preferred), or as planContent.');
    }

    const fs = await import('fs/promises');
    const path = await import('path');

    const finalFilename = filename || (parsed.name ? planFileName(parsed.name) : 'test-plan.md');
    const plansDir = resolveOutputDir(outputDir, getSpecsDir());

    try {
      await fs.mkdir(plansDir, { recursive: true });
      const planPath = path.join(plansDir, finalFilename);
      const unrestricted = process.env.SELENIUM_MCP_UNRESTRICTED_FILES === 'true';
      validateOutputPath(planPath, unrestricted);
      // A saved plan is always a draft, also when the content says otherwise: a changed plan is reviewed again.
      await fs.writeFile(planPath, withPlanStatus(content, 'draft'));
      await import('../../plan-review-server.js').then(m => m.writeStaticPages()).catch(() => undefined);
      const note = await import('../../plan-review-server.js').then(m => m.sharedFolderNote(plansDir)).catch(() => '');

      return this.success(
        `Test plan saved as a draft to: ${planPath}${summary}${note}\n` +
        'Now let the user review it: planner_review_plan opens it as a page in their browser with Approve and Request ' +
        'changes buttons (or show it in the chat). Tests are only generated from an approved plan. ' +
        `When they approve it, call planner_approve_plan (specFile: "${finalFilename}") with their words; ` +
        `the generator then reads it with generator_read_spec (specFile: "${finalFilename}").`,
        false
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to save test plan: ${message}`);
    }
  }
}

// Planner Approve Plan Tool
const approvePlanSchema = z.object({
  specFile: z.string().describe('The plan to approve: a path, or its name in specs/ (e.g. "shopping-cart.md")'),
  approval: z.string()
    .describe("The user's own words approving the plan, quoted from the chat (e.g. \"looks good, generate the tests\")"),
});

export class PlannerApprovePlanTool extends BaseTool {
  readonly name = 'planner_approve_plan';
  readonly description =
    'Mark a reviewed test plan as approved, so the generator may write tests from it. Call it ONLY after the user ' +
    'has read the plan and explicitly approved it in the chat, and pass their words as "approval": never approve a ' +
    'plan yourself. The approval and the time are written into the plan. If the user asks for changes, save the ' +
    'changed plan with planner_save_plan (a draft again) and ask again.';
  readonly inputSchema = approvePlanSchema;
  readonly category: ToolCategory = 'agent';

  async execute(_context: Context, params: unknown): Promise<ToolResult> {
    const { specFile, approval } = this.parseParams(approvePlanSchema, params);
    if (!approval.trim()) {
      return this.error('Not approved: give the user\'s own words approving the plan. Ask the user to review it first.');
    }
    const fs = await import('fs/promises');
    try {
      const { file, content } = await findSpec(specFile);
      const unrestricted = process.env.SELENIUM_MCP_UNRESTRICTED_FILES === 'true';
      validateOutputPath(file, unrestricted);
      const before = planStatus(content);
      const when = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const words = approval.replace(/\s+/g, ' ').trim().slice(0, 200).replace(/"/g, "'");
      await fs.writeFile(file, withPlanStatus(content, 'approved', `approved by the user on ${when} UTC: "${words}"`));
      await import('../../plan-review-server.js').then(m => m.writeStaticPages()).catch(() => undefined);
      return this.success(
        `Test plan approved: ${file}${before === 'approved' ? ' (it was already approved; the approval is updated)' : ''}\n` +
        'The generator can now write tests from it (generator_setup_page, generator_read_spec).',
        false
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to approve the plan: ${message}`);
    }
  }
}

// Planner Review Plan Tool
const reviewPlanSchema = z.object({
  specFile: z.string().optional()
    .describe('The plan to review: its name in specs/ (e.g. "login.md"). Leave it out to open the overview of all plans.'),
  open: z.boolean().optional().describe('Open the page in the user\'s browser (default: true). false only returns the link.'),
});

export class PlannerReviewPlanTool extends BaseTool {
  readonly name = 'planner_review_plan';
  readonly description =
    'Open a test plan as a review page in the user\'s browser: suites, tests, steps with their expected results, ' +
    'elements and gaps, with a comment box per test and Approve / Request changes buttons that write the decision ' +
    'into the plan. Without specFile it opens the overview of all plans in specs/ (review status, tests, generated ' +
    'test files, last run). Other Markdown in that folder is not a plan and is left alone. Read-only copies are ' +
    'saved in .selenium-ai-agent/review/ (ignored by git).\n\n' +
    'Use it after planner_save_plan: ask the user to review the plan in the page, then call it again (or read the ' +
    'plan) to see their decision. "approved": continue with the generator. "changes requested": read the "Review ' +
    'comments" in the plan, change the plan, save it and ask for a review again.';
  readonly inputSchema = reviewPlanSchema;
  readonly category: ToolCategory = 'agent';

  async execute(_context: Context, params: unknown): Promise<ToolResult> {
    const { specFile, open = true } = this.parseParams(reviewPlanSchema, params);
    const path = await import('path');
    const { ensureReviewServer, reviewUrls, writeStaticPages, listPlans, openInBrowser } = await import('../../plan-review-server.js');
    try {
      let file: string | undefined;
      let status: string | undefined;
      if (specFile) {
        const found = await findSpec(specFile);
        if (path.dirname(found.file) !== getSpecsDir()) {
          return this.error(`The review page shows plans in ${getSpecsDir()}; ${found.file} is somewhere else. Save it there with planner_save_plan.`);
        }
        file = path.basename(found.file);
        const { isPlanMarkdown } = await import('../../utils/plan-review.js');
        if (!isPlanMarkdown(found.content)) {
          // A plan written by hand, without a status: asking to review it makes it a plan (a draft).
          const fs = await import('fs/promises');
          await fs.writeFile(found.file, withPlanStatus(found.content, 'draft'));
          found.content = withPlanStatus(found.content, 'draft');
        }
        status = planStatus(found.content) ?? 'draft';
      }
      await ensureReviewServer();
      const pageUrl = file ? reviewUrls.plan(file) : reviewUrls.overview();
      const staticIndex = await writeStaticPages();
      const opened = open ? await openInBrowser(pageUrl) : false;
      const plans = await listPlans();
      return this.success(JSON.stringify({
        message: file
          ? `Review page for ${file} ${opened ? 'opened in the user\'s browser' : 'ready'}.`
          : `Overview of ${plans.length} test plan(s) ${opened ? 'opened in the user\'s browser' : 'ready'}.`,
        url: pageUrl,
        ...(file ? { plan: file, status } : { plans }),
        readOnlyCopies: staticIndex.replace(/index\.html$/, '<plan>.html and index.html'),
        planReview: planReviewRequired() ? 'required: tests are only generated from approved plans' : 'off (SELENIUM_MCP_PLAN_REVIEW=off)',
        next: file
          ? 'Ask the user to review the plan in the page and click Approve plan or Request changes (with comments), and to tell you when done. Then call planner_review_plan again to read the decision.'
          : 'The user can open each plan from the overview to review it.',
        reviewYourself: 'The user can also open these pages without you: npx selenium-ai-agent review (in the project folder).',
        ...(opened || !open ? {} : { note: 'Could not open a browser here: give the user the url.' }),
      }, null, 2), false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to open the review page: ${message}`);
    }
  }
}
