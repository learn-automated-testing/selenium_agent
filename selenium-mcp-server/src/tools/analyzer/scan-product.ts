import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context, DiscoveredFeature, DiscoveredPage } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { By } from 'selenium-webdriver';

const schema = z.object({
  scanDepth: z.enum(['quick', 'standard', 'deep']).optional().default('standard')
    .describe("Scan depth: 'quick' (homepage only), 'standard' (main navigation), 'deep' (follow all links)"),
  maxPages: z.number().optional().default(20).describe('Maximum number of pages to scan'),
  focusAreas: z.array(z.string()).optional().describe("Specific areas to focus on (e.g., ['checkout', 'account'])")
});

export class AnalyzerScanProductTool extends BaseTool {
  readonly name = 'analyzer_scan_product';
  readonly description = 'Explore the product using both process walking (from imported context) and page scanning';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'analyzer';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { scanDepth, maxPages, focusAreas } = this.parseParams(schema, params);

    if (!context.analysisSession) {
      return this.error('No analysis session active. Run analyzer_setup first.');
    }

    const driver = await context.getDriver();
    const baseUrl = context.analysisSession.url;

    const url = new URL(baseUrl);
    const baseDomain = url.hostname;

    const discoveredFeatures: DiscoveredFeature[] = [];
    const discoveredPages: DiscoveredPage[] = [];
    const visitedUrls = new Set<string>();

    // Phase 1: Page Scanning
    const depth = scanDepth ?? 'standard';
    const maxPagesNum = maxPages ?? 20;

    // Start from base URL
    await driver.get(baseUrl);
    await context.captureSnapshot();

    // Capture homepage screenshot
    await this.captureScreenshot(context, driver, 'homepage');

    // Discover features on current page
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
          await new Promise(r => setTimeout(r, 1000));

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
          continue;
        }
      }
    }

    // Store results in session
    context.analysisSession.discoveredFeatures = discoveredFeatures;
    context.analysisSession.discoveredPages = discoveredPages;

    // Check imported context for focus areas or critical flows
    const importedContextSummary = context.analysisSession.importedContext.length > 0
      ? `${context.analysisSession.importedContext.length} context(s) imported — used for risk profiling`
      : 'No context imported — use analyzer_import_context to provide PRD or scope';

    const result = {
      message: 'Product scan completed',
      scanDepth: depth,
      importedContext: importedContextSummary,
      summary: {
        pagesVisited: visitedUrls.size,
        featuresDiscovered: discoveredFeatures.length
      },
      pages: discoveredPages.map(p => ({
        url: p.url,
        title: p.title,
        featureCount: p.features.length
      })),
      topFeatures: discoveredFeatures.slice(0, 15).map(f => ({
        name: f.name,
        type: f.type,
        url: f.url
      })),
      nextSteps: [
        ...(context.analysisSession.importedContext.length === 0
          ? ['Use analyzer_import_context to provide PRD, user stories, or scope (recommended)']
          : []),
        'Use analyzer_build_risk_profile to generate risk assessment',
        'Use analyzer_generate_documentation to create documentation'
      ]
    };

    return this.success(JSON.stringify(result, null, 2), true);
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

  private async discoverPageFeatures(_context: Context, driver: any): Promise<DiscoveredFeature[]> {
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

    return [...new Set(links)];
  }
}
