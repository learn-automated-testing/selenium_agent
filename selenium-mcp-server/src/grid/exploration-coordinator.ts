import { WebDriver } from 'selenium-webdriver';
import {
  ExplorationTarget,
  ExplorationResult,
  ExplorationMergeResult,
  DiscoveredPageDetail,
  FormInfo,
  LinkInfo,
  DiscoveredWorkflow,
  SiteMapEntry,
} from '../types.js';
import { SessionPool } from './session-pool.js';
import { GridSession } from './grid-session.js';
import { discoverElements } from '../utils/element-discovery.js';

let explorationCounter = 0;

/**
 * Browser-side JS that extracts all form info in a single call.
 * Returns array of { action, method, fields[] }.
 */
const EXTRACT_FORMS_SCRIPT = `
  var formEls = document.querySelectorAll('form');
  var results = [];
  var maxForms = 10;
  var maxFields = 20;

  for (var i = 0; i < formEls.length && i < maxForms; i++) {
    var form = formEls[i];
    var action = form.getAttribute('action') || '';
    var method = (form.getAttribute('method') || 'get').toLowerCase();
    var fields = [];

    var inputs = form.querySelectorAll('input, select, textarea');
    for (var j = 0; j < inputs.length && j < maxFields; j++) {
      var inp = inputs[j];
      var name = inp.getAttribute('name') || '';
      var type = inp.getAttribute('type') || 'text';
      var required = inp.hasAttribute('required');
      var label = inp.getAttribute('aria-label') || '';

      if (name || type !== 'hidden') {
        fields.push({
          name: name,
          type: type,
          required: required,
          label: label || null
        });
      }
    }

    results.push({ action: action, method: method, fields: fields });
  }

  return results;
`;

/**
 * Browser-side JS that extracts all link info in a single call.
 * Returns array of { href, text, isInternal }.
 */
const EXTRACT_LINKS_SCRIPT = `
  var baseUrl = arguments[0];
  var anchors = document.querySelectorAll('a[href]');
  var results = [];
  var seen = {};
  var maxLinks = 50;

  for (var i = 0; i < anchors.length && results.length < maxLinks; i++) {
    var a = anchors[i];
    var href = a.href;  // fully resolved
    if (!href || seen[href]) continue;
    seen[href] = true;

    var text = (a.textContent || '').trim().slice(0, 100);
    var rawHref = a.getAttribute('href') || '';
    // Skip non-navigable protocols
    if (href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0 ||
        href.indexOf('javascript:') === 0 || href.indexOf('blob:') === 0) continue;

    var isInternal = href.indexOf(baseUrl) === 0 ||
                     rawHref.indexOf('/') === 0 ||
                     (rawHref.indexOf('http') !== 0 && rawHref.indexOf('mailto:') !== 0 && rawHref.indexOf('tel:') !== 0);

    results.push({ href: href, text: text, isInternal: isInternal });
  }

  return results;
`;

export class ExplorationCoordinator {
  private pool: SessionPool;
  private results = new Map<string, ExplorationResult>();

  constructor(pool: SessionPool) {
    this.pool = pool;
  }

  async explore(
    baseUrl: string,
    targets: ExplorationTarget[],
    options: { concurrency?: number; browser?: string; tags?: string[] } = {}
  ): Promise<ExplorationResult[]> {
    const { browser = 'chrome', tags = ['exploration'] } = options;

    // Create one session per target, then explore in parallel
    const tasks = targets.map(async (target) => {
      const explorationId = `exp-${++explorationCounter}`;
      const session = await this.pool.createSession(
        { browserName: browser },
        `${explorationId}-session`,
        tags
      );

      try {
        const result = await this.exploreTarget(session, baseUrl, target, explorationId);
        this.results.set(explorationId, result);
        return result;
      } catch (err) {
        const errorResult: ExplorationResult = {
          explorationId,
          target,
          sessionId: session.sessionId,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
          pages: [],
          workflows: [],
          startedAt: Date.now(),
          completedAt: Date.now(),
          duration: 0,
        };
        this.results.set(explorationId, errorResult);
        return errorResult;
      }
    });

    return Promise.allSettled(tasks).then(results =>
      results.map(r => r.status === 'fulfilled' ? r.value : {
        explorationId: `exp-error`,
        target: { url: '' },
        sessionId: '',
        status: 'failed' as const,
        error: r.status === 'rejected' ? String(r.reason) : 'Unknown error',
        pages: [],
        workflows: [],
        startedAt: Date.now(),
        completedAt: Date.now(),
        duration: 0,
      })
    );
  }

  private async exploreTarget(
    session: GridSession,
    baseUrl: string,
    target: ExplorationTarget,
    explorationId: string
  ): Promise<ExplorationResult> {
    const startedAt = Date.now();
    const maxDepth = target.maxDepth ?? 2;
    const maxPages = target.maxPages ?? 20;

    // Authenticate if needed
    if (target.auth) {
      await this.authenticate(session, target.auth, target.url);
    }

    // Discover pages via BFS
    const pages = await this.discoverPages(session, target.url, maxDepth, maxPages, baseUrl);

    // Detect simple workflows (sequential form submissions)
    const workflows = this.detectWorkflows(pages);

    const completedAt = Date.now();
    return {
      explorationId,
      target,
      sessionId: session.sessionId,
      status: pages.length > 0 ? 'completed' : 'partial',
      pages,
      workflows,
      startedAt,
      completedAt,
      duration: completedAt - startedAt,
    };
  }

  private async authenticate(
    session: GridSession,
    auth: ExplorationTarget['auth'],
    targetUrl: string
  ): Promise<void> {
    if (!auth) return;

    const driver = session.getDriver();
    const loginUrl = auth.loginUrl || targetUrl;
    await driver.get(loginUrl);

    const usernameSelector = auth.usernameSelector || 'input[name="username"], input[type="email"], #username, #email';
    const passwordSelector = auth.passwordSelector || 'input[name="password"], input[type="password"], #password';
    const submitSelector = auth.submitSelector || 'button[type="submit"], input[type="submit"]';

    const usernameEl = await driver.findElement({ css: usernameSelector });
    await usernameEl.clear();
    await usernameEl.sendKeys(auth.username);

    const passwordEl = await driver.findElement({ css: passwordSelector });
    await passwordEl.clear();
    await passwordEl.sendKeys(auth.password);

    const submitEl = await driver.findElement({ css: submitSelector });
    await submitEl.click();

    // Wait for navigation
    await driver.sleep(2000);
  }

  private async discoverPages(
    session: GridSession,
    startUrl: string,
    maxDepth: number,
    maxPages: number,
    baseUrl: string
  ): Promise<DiscoveredPageDetail[]> {
    const driver = session.getDriver();
    const visited = new Set<string>();
    const pages: DiscoveredPageDetail[] = [];
    const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }];

    while (queue.length > 0 && pages.length < maxPages) {
      const { url, depth } = queue.shift()!;

      // Normalize URL for dedup
      const normalizedUrl = this.normalizeUrl(url);
      if (visited.has(normalizedUrl)) continue;
      visited.add(normalizedUrl);

      try {
        await driver.get(url);

        const currentUrl = await driver.getCurrentUrl();
        const title = await driver.getTitle();

        // Discover elements (single executeScript call)
        const elements = await discoverElements(driver);

        // Extract forms (single executeScript call)
        const forms = await this.extractForms(driver);

        // Extract links (single executeScript call)
        const links = await this.extractLinks(driver, baseUrl);

        // Build interactive element summary
        const interactiveElements: string[] = [];
        for (const [ref, info] of elements) {
          interactiveElements.push(`[${ref}] ${info.tagName}: ${(info.ariaLabel || info.text || '').slice(0, 40)}`);
        }

        pages.push({
          url: currentUrl,
          title,
          depth,
          elements: elements.size,
          forms,
          links,
          interactiveElements,
        });

        // Enqueue internal links for BFS if within depth limit
        if (depth < maxDepth) {
          for (const link of links) {
            if (link.isInternal && !visited.has(this.normalizeUrl(link.href))
                && (link.href.startsWith('http://') || link.href.startsWith('https://'))) {
              queue.push({ url: link.href, depth: depth + 1 });
            }
          }
        }
      } catch {
        // Skip pages that fail to load
        continue;
      }
    }

    return pages;
  }

  private async extractForms(driver: WebDriver): Promise<FormInfo[]> {
    const rawForms = await driver.executeScript(EXTRACT_FORMS_SCRIPT) as Array<{
      action: string;
      method: string;
      fields: Array<{ name: string; type: string; required: boolean; label: string | null }>;
    }>;

    return rawForms.map(f => ({
      action: f.action,
      method: f.method,
      fields: f.fields.map(field => ({
        name: field.name,
        type: field.type,
        required: field.required,
        label: field.label || undefined,
      })),
    }));
  }

  private async extractLinks(driver: WebDriver, baseUrl: string): Promise<LinkInfo[]> {
    const rawLinks = await driver.executeScript(EXTRACT_LINKS_SCRIPT, baseUrl) as Array<{
      href: string;
      text: string;
      isInternal: boolean;
    }>;

    return rawLinks;
  }

  private detectWorkflows(pages: DiscoveredPageDetail[]): DiscoveredWorkflow[] {
    const workflows: DiscoveredWorkflow[] = [];

    // Detect form-based workflows: pages with forms that submit to other discovered pages
    for (const page of pages) {
      for (const form of page.forms) {
        if (form.fields.length >= 2 && form.action) {
          const targetPage = pages.find(p => p.url.includes(form.action) || form.action.includes(new URL(p.url).pathname));
          if (targetPage) {
            workflows.push({
              name: `Form submission: ${page.title} -> ${targetPage.title}`,
              steps: [
                { url: page.url, action: 'navigate' },
                { url: page.url, action: `fill_form(${form.fields.map(f => f.name).join(', ')})` },
                { url: page.url, action: 'submit' },
                { url: targetPage.url, action: 'verify_navigation' },
              ],
            });
          }
        }
      }
    }

    return workflows;
  }

  merge(explorationIds: string[], _outputFormat?: string): ExplorationMergeResult {
    const explorations = explorationIds
      .map(id => this.results.get(id))
      .filter((r): r is ExplorationResult => r !== undefined);

    if (explorations.length === 0) {
      throw new Error('No explorations found for the given IDs');
    }

    const urlMap = new Map<string, SiteMapEntry>();
    const allForms: FormInfo[] = [];
    const allWorkflows: DiscoveredWorkflow[] = [];
    let totalPages = 0;

    for (const exploration of explorations) {
      for (const page of exploration.pages) {
        totalPages++;
        const normalized = this.normalizeUrl(page.url);
        const existing = urlMap.get(normalized);

        if (existing) {
          existing.discoveredBy.push(exploration.explorationId);
        } else {
          urlMap.set(normalized, {
            url: page.url,
            title: page.title,
            depth: page.depth,
            discoveredBy: [exploration.explorationId],
            forms: page.forms.length,
            links: page.links.length,
            interactiveElements: page.elements,
          });
        }

        allForms.push(...page.forms);
      }

      allWorkflows.push(...exploration.workflows);
    }

    return {
      mergedAt: Date.now(),
      explorationIds,
      totalPages,
      uniquePages: urlMap.size,
      duplicatesRemoved: totalPages - urlMap.size,
      siteMap: Array.from(urlMap.values()),
      allForms,
      allWorkflows,
    };
  }

  diff(baselineId: string, currentId: string): {
    added: string[];
    removed: string[];
    changed: { url: string; elementDiff: number }[];
  } {
    const baseline = this.results.get(baselineId);
    const current = this.results.get(currentId);

    if (!baseline) throw new Error(`Baseline exploration not found: ${baselineId}`);
    if (!current) throw new Error(`Current exploration not found: ${currentId}`);

    const baselineUrls = new Map(baseline.pages.map(p => [this.normalizeUrl(p.url), p]));
    const currentUrls = new Map(current.pages.map(p => [this.normalizeUrl(p.url), p]));

    const added: string[] = [];
    const removed: string[] = [];
    const changed: { url: string; elementDiff: number }[] = [];

    for (const [url, page] of currentUrls) {
      const baselinePage = baselineUrls.get(url);
      if (!baselinePage) {
        added.push(page.url);
      } else if (baselinePage.elements !== page.elements) {
        changed.push({
          url: page.url,
          elementDiff: page.elements - baselinePage.elements,
        });
      }
    }

    for (const [url, page] of baselineUrls) {
      if (!currentUrls.has(url)) {
        removed.push(page.url);
      }
    }

    return { added, removed, changed };
  }

  getResult(explorationId: string): ExplorationResult | undefined {
    return this.results.get(explorationId);
  }

  private normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      // Remove trailing slash, fragment, and sort params for consistent comparison
      u.hash = '';
      const path = u.pathname.replace(/\/+$/, '') || '/';
      u.pathname = path;
      u.searchParams.sort();
      return u.toString();
    } catch {
      return url;
    }
  }
}
