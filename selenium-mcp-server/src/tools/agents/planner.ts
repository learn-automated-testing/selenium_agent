import { z } from 'zod';
import { By } from 'selenium-webdriver';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { getTestPlansDir, resolveOutputDir } from '../../utils/paths.js';
import { validateOutputPath } from '../../utils/sandbox.js';

// Planner Setup Tool
const setupSchema = z.object({
  url: z.string().describe('URL of the web application to test'),
  feature: z.string().describe('Name of the feature to create test plan for'),
  explorationDepth: z.enum(['quick', 'single_page', 'section', 'full_site']).optional().default('quick')
    .describe('Depth of exploration')
});

export class PlannerSetupTool extends BaseTool {
  readonly name = 'planner_setup_page';
  readonly description = 'Initialize the testing environment and navigate to the application for test planning';
  readonly inputSchema = setupSchema;
  readonly category: ToolCategory = 'agent';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { url, feature, explorationDepth } = this.parseParams(setupSchema, params);

    const driver = await context.ensureBrowser();
    await driver.get(url);
    await context.captureSnapshot();

    // Discover navigation links
    const navLinks = await this.discoverNavigationLinks(driver);

    const result = {
      message: `Planning session initialized for '${feature}'`,
      url,
      explorationDepth,
      navigationLinks: navLinks,
      ready: true
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
  readonly description = 'Explore a specific page in detail, discovering elements and forms';
  readonly inputSchema = exploreSchema;
  readonly category: ToolCategory = 'agent';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { pageUrl, pageName } = this.parseParams(exploreSchema, params);

    const driver = await context.getDriver();

    if (pageUrl) {
      await driver.get(pageUrl);
    }

    await context.captureSnapshot();

    // Discover forms
    const forms = await this.discoverForms(driver);

    const result = {
      message: `Page '${pageName}' explored successfully`,
      url: await driver.getCurrentUrl(),
      title: await driver.getTitle(),
      formsCount: forms.length,
      forms
    };

    return this.success(JSON.stringify(result, null, 2), true);
  }

  private async discoverForms(driver: any): Promise<Array<{ action: string; method: string; fields: number }>> {
    const forms: Array<{ action: string; method: string; fields: number }> = [];

    try {
      const formElements = await driver.findElements(By.tagName('form'));
      for (const form of formElements) {
        const action = await form.getAttribute('action') || '';
        const method = await form.getAttribute('method') || 'GET';
        const inputs = await form.findElements(By.css('input, textarea, select'));
        forms.push({ action, method, fields: inputs.length });
      }
    } catch { /* ignore */ }

    return forms;
  }
}

// Planner Save Plan Tool
const savePlanSchema = z.object({
  planContent: z.string().describe('Complete test plan content in markdown format'),
  filename: z.string().optional().describe('Filename for the test plan'),
  outputDir: z.string().optional().describe('Output directory for the test plan (default: test-plans/)')
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
    const plansDir = resolveOutputDir(outputDir, getTestPlansDir());

    try {
      await fs.mkdir(plansDir, { recursive: true });
      const planPath = path.join(plansDir, finalFilename);
      const unrestricted = process.env.SELENIUM_MCP_UNRESTRICTED_FILES === 'true';
      validateOutputPath(planPath, unrestricted);
      await fs.writeFile(planPath, planContent);

      return this.success(`Test plan saved to: ${planPath}`, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to save test plan: ${message}`);
    }
  }
}
