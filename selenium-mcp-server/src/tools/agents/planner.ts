import { z } from 'zod';
import { By } from 'selenium-webdriver';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { getOutputDir, getSpecsDir, resolveOutputDir } from '../../utils/paths.js';
import { readManifest } from '../../types/manifest.js';
import { runSetupSteps, setupStepSchema } from '../../utils/setup-steps.js';
import { validateOutputPath } from '../../utils/sandbox.js';
import { getPageInventory } from '../../utils/page-inventory.js';

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
        `Page '${pageName}' explored: ${inventory.totals.fields} fields, ` +
        `${inventory.totals.buttons} buttons, ${inventory.totals.links} links, ${inventory.forms.length} forms`,
      url: await driver.getCurrentUrl(),
      title: await driver.getTitle(),
      ...inventory,
    };

    return this.success(JSON.stringify(result, null, 2), true);
  }
}

// Planner Save Plan Tool
const savePlanSchema = z.object({
  planContent: z.string().describe('Complete test plan content in markdown format'),
  filename: z.string().optional().describe('Filename for the test plan'),
  outputDir: z.string().optional().describe('Folder for the plan (default: specs/, where the generator reads plans)')
});

export class PlannerSavePlanTool extends BaseTool {
  readonly name = 'planner_save_plan';
  readonly description = 'Save the completed test plan to a markdown file';
  readonly inputSchema = savePlanSchema;
  readonly category: ToolCategory = 'agent';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { planContent, filename, outputDir } = this.parseParams(savePlanSchema, params);

    const fs = await import('fs/promises');
    const path = await import('path');

    const finalFilename = filename || 'test-plan.md';
    const plansDir = resolveOutputDir(outputDir, getSpecsDir());

    try {
      await fs.mkdir(plansDir, { recursive: true });
      const planPath = path.join(plansDir, finalFilename);
      const unrestricted = process.env.SELENIUM_MCP_UNRESTRICTED_FILES === 'true';
      validateOutputPath(planPath, unrestricted);
      await fs.writeFile(planPath, planContent);

      return this.success(
        `Test plan saved to: ${planPath}\nThe generator reads it with generator_read_spec (specFile: "${finalFilename}").`,
        false
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to save test plan: ${message}`);
    }
  }
}
