import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context, DiscoveredFeature, DiscoveredPage, ProcessResult, ProcessStepResult, ScreenshotInfo } from '../../context.js';
import { ToolResult } from '../../types.js';
import { By } from 'selenium-webdriver';

const schema = z.object({
  scanDepth: z.enum(['quick', 'standard', 'deep']).optional().default('standard')
    .describe("Scan depth: 'quick' (homepage only), 'standard' (main navigation), 'deep' (follow all links)"),
  maxPages: z.number().optional().default(20).describe('Maximum number of pages to scan'),
  focusAreas: z.array(z.string()).optional().describe("Specific areas to focus on (e.g., ['checkout', 'account'])"),
  walkProcesses: z.boolean().optional().default(true)
    .describe('Walk through domain template processes (active discovery). Combined with page scanning.'),
  processesToWalk: z.array(z.string()).optional()
    .describe("Specific processes to walk (e.g., ['purchase_product', 'user_login']). If null, walks all.")
});

export class AnalyzerScanProductTool extends BaseTool {
  readonly name = 'analyzer_scan_product';
  readonly description = 'Explore the product using both process walking (from domain template) and page scanning';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { scanDepth, maxPages, focusAreas, walkProcesses, processesToWalk } = this.parseParams(schema, params);

    if (!context.analysisSession) {
      return this.error('No analysis session active. Run analyzer_setup first.');
    }

    const driver = await context.getDriver();
    const baseUrl = context.analysisSession.url;
    const domainTemplate = context.analysisSession.domainTemplate;
    const useDomainTemplate = context.analysisSession.useDomainTemplate;

    const url = new URL(baseUrl);
    const baseDomain = url.hostname;

    const discoveredFeatures: DiscoveredFeature[] = [];
    const discoveredPages: DiscoveredPage[] = [];
    const visitedUrls = new Set<string>();
    const processResults: Record<string, ProcessResult> = {};
    const advisoryGaps: { process: string; expected: string; status: string }[] = [];

    // Phase 1: Process Walking (if domain template and enabled)
    if (walkProcesses && domainTemplate && useDomainTemplate) {
      const processes = domainTemplate.processes || {};
      const toWalk = processesToWalk || Object.keys(processes);

      for (const processName of toWalk) {
        const processDef = processes[processName];
        if (!processDef) continue;

        const result = await this.walkProcess(
          context,
          driver,
          processName,
          processDef,
          baseUrl
        );

        processResults[processName] = result;

        // Track discovered features from process
        for (const step of result.steps) {
          if (step.status === 'found' || step.status === 'completed') {
            discoveredFeatures.push({
              name: `${processDef.name || processName}: ${step.stepName}`,
              url: step.url || baseUrl,
              type: 'process_step',
              description: step.stepAction
            });
          }
        }

        // Track gaps
        if (result.status === 'incomplete') {
          advisoryGaps.push({
            process: processName,
            expected: processDef.name || processName,
            status: `Only ${result.stepsCompleted}/${result.stepsTotal} steps completed`
          });
        }
      }
    }

    // Phase 2: Page Scanning
    const depth = scanDepth || 'standard';
    const maxPagesNum = maxPages || 20;

    // Start from base URL
    await driver.get(baseUrl);
    await context.captureSnapshot();

    // Capture homepage screenshot
    await this.captureScreenshot(context, driver, 'homepage');

    // Discover links on current page
    const pageFeatures = await this.discoverPageFeatures(context, driver);
    discoveredFeatures.push(...pageFeatures);

    const currentUrl = await driver.getCurrentUrl();
    const currentTitle = await driver.getTitle();
    discoveredPages.push({
      url: currentUrl,
      title: currentTitle,
      features: pageFeatures.map(f => f.name)
    });
    visitedUrls.add(currentUrl);

    // If not quick scan, explore more pages
    if (depth !== 'quick') {
      const links = await this.discoverLinks(driver, baseDomain, focusAreas);
      const linksToVisit = links.slice(0, maxPagesNum - 1);

      for (const link of linksToVisit) {
        if (visitedUrls.has(link)) continue;

        try {
          await driver.get(link);
          await new Promise(r => setTimeout(r, 1000)); // Wait for page load

          const pageUrl = await driver.getCurrentUrl();
          const pageTitle = await driver.getTitle();

          if (visitedUrls.has(pageUrl)) continue;
          visitedUrls.add(pageUrl);

          await context.captureSnapshot();

          const features = await this.discoverPageFeatures(context, driver);
          discoveredFeatures.push(...features);

          discoveredPages.push({
            url: pageUrl,
            title: pageTitle,
            features: features.map(f => f.name)
          });

          // Deep scan: follow links from this page too
          if (depth === 'deep' && visitedUrls.size < maxPagesNum) {
            const moreLinks = await this.discoverLinks(driver, baseDomain, focusAreas);
            for (const moreLink of moreLinks.slice(0, 5)) {
              if (!visitedUrls.has(moreLink)) {
                linksToVisit.push(moreLink);
              }
            }
          }
        } catch {
          // Skip pages that fail to load
          continue;
        }
      }
    }

    // Store results in session
    context.analysisSession.discoveredFeatures = discoveredFeatures;
    context.analysisSession.discoveredPages = discoveredPages;
    context.analysisSession.processResults = processResults;
    context.analysisSession.advisoryGaps = advisoryGaps;

    // Build summary
    const result = {
      message: 'Product scan completed',
      scanMode: useDomainTemplate ? 'domain_focused' : 'scan_all',
      scanDepth: depth,
      summary: {
        pagesVisited: visitedUrls.size,
        featuresDiscovered: discoveredFeatures.length,
        processesWalked: Object.keys(processResults).length,
        advisoryGaps: advisoryGaps.length
      },
      processResults: Object.entries(processResults).map(([name, r]) => ({
        process: name,
        status: r.status,
        completed: `${r.stepsCompleted}/${r.stepsTotal}`
      })),
      topFeatures: discoveredFeatures.slice(0, 10).map(f => ({
        name: f.name,
        type: f.type,
        url: f.url
      })),
      advisoryGaps: advisoryGaps.slice(0, 5),
      nextSteps: [
        'Review discovered features for accuracy',
        'Use analyzer_build_risk_profile to generate risk assessment',
        'Use analyzer_generate_documentation to create documentation'
      ]
    };

    return this.success(JSON.stringify(result, null, 2), true);
  }

  private async walkProcess(
    context: Context,
    driver: any,
    processName: string,
    processDef: any,
    baseUrl: string
  ): Promise<ProcessResult> {
    const steps = processDef.steps || [];
    const stepResults: ProcessStepResult[] = [];
    const screenshots: ScreenshotInfo[] = [];
    let stepsCompleted = 0;

    // Navigate to base URL to start
    await driver.get(baseUrl);
    await new Promise(r => setTimeout(r, 1000));

    for (const step of steps) {
      const stepResult: ProcessStepResult = {
        stepName: step.name,
        stepAction: step.action,
        status: 'pending',
        url: undefined
      };

      try {
        // Try to find element based on step definition
        if (step.selector) {
          const element = await driver.findElement(By.css(step.selector));
          if (await element.isDisplayed()) {
            stepResult.status = 'found';
            stepResult.url = await driver.getCurrentUrl();

            // Capture screenshot for this step
            const screenshotName = `${processName}_${step.name}`.replace(/\s+/g, '_').toLowerCase();
            await this.captureScreenshot(context, driver, screenshotName, step.name, processName);

            stepsCompleted++;
          }
        } else if (step.url) {
          // Navigate to step URL
          await driver.get(step.url.startsWith('http') ? step.url : baseUrl + step.url);
          await new Promise(r => setTimeout(r, 1000));
          stepResult.status = 'navigated';
          stepResult.url = await driver.getCurrentUrl();
          stepsCompleted++;

          // Capture screenshot
          const screenshotName = `${processName}_${step.name}`.replace(/\s+/g, '_').toLowerCase();
          await this.captureScreenshot(context, driver, screenshotName, step.name, processName);
        } else {
          // Try to find by text content
          const textToFind = step.action.toLowerCase();
          const elements = await driver.findElements(By.xpath(`//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${textToFind.slice(0, 20)}')]`));

          if (elements.length > 0) {
            stepResult.status = 'found';
            stepResult.url = await driver.getCurrentUrl();
            stepsCompleted++;
          } else {
            stepResult.status = 'not_found';
          }
        }
      } catch (err) {
        stepResult.status = 'error';
      }

      stepResults.push(stepResult);
    }

    return {
      processDisplayName: processDef.name || processName,
      description: processDef.description,
      risk: processDef.risk || 'medium',
      status: stepsCompleted === steps.length ? 'complete' : stepsCompleted > 0 ? 'incomplete' : 'not_started',
      stepsCompleted,
      stepsTotal: steps.length,
      steps: stepResults,
      screenshots
    };
  }

  private async captureScreenshot(
    context: Context,
    driver: any,
    name: string,
    step?: string,
    process?: string
  ): Promise<void> {
    if (!context.analysisSession) return;

    const fs = await import('fs/promises');
    const path = await import('path');

    const filename = `${name}.png`;
    const filepath = path.join(context.analysisSession.screenshotsDir, filename);

    try {
      const screenshot = await driver.takeScreenshot();
      await fs.writeFile(filepath, screenshot, 'base64');

      context.analysisSession.screenshots.push({
        name,
        file: filename,
        step,
        process
      });
    } catch {
      // Ignore screenshot errors
    }
  }

  private async discoverPageFeatures(context: Context, driver: any): Promise<DiscoveredFeature[]> {
    const features: DiscoveredFeature[] = [];
    const currentUrl = await driver.getCurrentUrl();

    // Look for forms
    const forms = await driver.findElements(By.tagName('form'));
    for (let i = 0; i < Math.min(forms.length, 5); i++) {
      try {
        const action = await forms[i].getAttribute('action');
        const id = await forms[i].getAttribute('id');
        features.push({
          name: `Form: ${id || action || 'unknown'}`,
          url: currentUrl,
          type: 'form'
        });
      } catch { /* skip */ }
    }

    // Look for buttons
    const buttons = await driver.findElements(By.css('button, [role="button"], input[type="submit"]'));
    for (let i = 0; i < Math.min(buttons.length, 10); i++) {
      try {
        const text = await buttons[i].getText();
        const ariaLabel = await buttons[i].getAttribute('aria-label');
        const label = text || ariaLabel || 'button';
        if (label.trim()) {
          features.push({
            name: `Action: ${label.slice(0, 50)}`,
            url: currentUrl,
            type: 'action'
          });
        }
      } catch { /* skip */ }
    }

    // Look for navigation
    const navLinks = await driver.findElements(By.css('nav a, header a, [role="navigation"] a'));
    for (let i = 0; i < Math.min(navLinks.length, 10); i++) {
      try {
        const text = await navLinks[i].getText();
        const href = await navLinks[i].getAttribute('href');
        if (text.trim()) {
          features.push({
            name: `Navigation: ${text.slice(0, 50)}`,
            url: href || currentUrl,
            type: 'navigation'
          });
        }
      } catch { /* skip */ }
    }

    return features;
  }

  private async discoverLinks(driver: any, baseDomain: string, focusAreas?: string[]): Promise<string[]> {
    const links: string[] = [];

    try {
      const anchors = await driver.findElements(By.tagName('a'));

      for (const anchor of anchors.slice(0, 50)) {
        try {
          const href = await anchor.getAttribute('href');
          if (!href) continue;

          const linkUrl = new URL(href, await driver.getCurrentUrl());

          // Only include links from same domain
          if (linkUrl.hostname !== baseDomain) continue;

          // Skip anchors and javascript
          if (href.startsWith('#') || href.startsWith('javascript:')) continue;

          // If focus areas specified, filter
          if (focusAreas && focusAreas.length > 0) {
            const matchesFocus = focusAreas.some(area =>
              href.toLowerCase().includes(area.toLowerCase())
            );
            if (!matchesFocus) continue;
          }

          links.push(linkUrl.href);
        } catch { /* skip */ }
      }
    } catch { /* skip */ }

    // Remove duplicates
    return [...new Set(links)];
  }
}
