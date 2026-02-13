import { Builder, WebDriver, WebElement } from 'selenium-webdriver';
import { PageSnapshot, BrowserConfig, TabInfo, ConsoleLogEntry, SnapshotOptions, ConsoleOptions, DiffOptions } from './types.js';
import { discoverElements, findElementByInfo } from './utils/element-discovery.js';
import { buildChromeOptions, applyStealthScripts } from './utils/chrome-options.js';
import { EventCollector } from './bidi/event-collector.js';
import { SessionTracer } from './trace/session-tracer.js';

// Forward-declared types for grid support — modules loaded dynamically via ensureGrid()
import type { SessionPool } from './grid/session-pool.js';
import type { GridClient } from './grid/grid-client.js';
import type { ExplorationCoordinator } from './grid/exploration-coordinator.js';
import type { GridSession } from './grid/grid-session.js';

// Locator info captured at recording time for durable test generation
export interface ElementLocator {
  id?: string;
  name?: string;
  tagName: string;
  text?: string;
  ariaLabel?: string;
  type?: string;
  placeholder?: string;
  href?: string;
}

// Action recorded during session
export interface RecordedAction {
  tool: string;
  params: Record<string, unknown>;
  timestamp: number;
  elements?: Record<string, ElementLocator>; // ref -> locator info, captured at record time
}

// Analysis session for regression analyzer
export interface AnalysisSession {
  productName: string;
  productSlug: string;
  url: string;
  compliance: string[];
  riskAppetite: string;
  criticalFlows: string[];
  discoveredFeatures: DiscoveredFeature[];
  discoveredPages: DiscoveredPage[];
  importedContext: ImportedContext[];
  riskProfile: RiskProfile | null;
  startedAt: string;
  outputDir: string;
  screenshotsDir: string;
  screenshots: ScreenshotInfo[];
  processDocumentation: ProcessDocumentation[];
  processResults: Record<string, ProcessResult>;
  advisoryGaps: AdvisoryGap[];
}

export interface DiscoveredFeature {
  name: string;
  url: string;
  type: string;
  elements?: string[];
  description?: string;
}

export interface DiscoveredPage {
  url: string;
  title: string;
  features: string[];
}

export interface ImportedContext {
  source: { type: string; path?: string; filename?: string; length?: number };
  contextType: string;
  description?: string;
  contentPreview: string;
  contentLength: number;
  importedAt: string;
  fullContent: string;
}

export interface RiskProfile {
  product: { name: string; url: string; domain: string; analyzedDate: string };
  businessContext: { type: string; compliance: string[]; riskAppetite: string; criticalFlows: string[] };
  features: FeatureAssessment[];
  coverageRecommendations: CoverageRecommendation[];
  gaps: RiskGap[];
  summary: RiskSummary;
  pipelineConfig?: PipelineConfig;
}

export interface FeatureAssessment {
  name: string;
  riskLevel: string;
  riskScore: number;
  skipRecommendation?: boolean;
  factors: Record<string, number>;
}

export interface CoverageRecommendation {
  feature: string;
  coverage: string;
  reason: string;
}

export interface RiskGap {
  expected: string;
  status: string;
  recommendation: string;
}

export interface RiskSummary {
  totalFeatures: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

export interface PipelineConfig {
  stages: PipelineStage[];
}

export interface PipelineStage {
  name: string;
  tests: string[];
  parallel?: boolean;
}

export interface ScreenshotInfo {
  name: string;
  file: string;
  step?: string;
  process?: string;
}

export interface ProcessDocumentation {
  process: string;
  steps: ProcessStepDoc[];
}

export interface ProcessStepDoc {
  name: string;
  screenshot?: string;
  status: string;
}

export interface ProcessResult {
  processDisplayName: string;
  description?: string;
  risk: string;
  status: string;
  stepsCompleted: number;
  stepsTotal: number;
  steps: ProcessStepResult[];
  screenshots: ScreenshotInfo[];
}

export interface ProcessStepResult {
  stepName: string;
  stepAction: string;
  status: string;
  url?: string;
}

export interface AdvisoryGap {
  process: string;
  expected: string;
  status: string;
}

export class Context {
  private driver: WebDriver | null = null;
  private snapshot: PageSnapshot | null = null;
  private config: BrowserConfig;
  private consoleLogs: ConsoleLogEntry[] = [];
  private previousSnapshotText: string | null = null;

  // Recording state
  public recordingEnabled = false;
  public actionHistory: RecordedAction[] = [];
  public generatorFramework: string | null = null;

  // Analysis session for regression analyzer
  public analysisSession: AnalysisSession | null = null;

  // Selenium Grid support — lazily initialized via ensureGrid()
  public sessionPool: SessionPool | null = null;
  public gridClient: GridClient | null = null;
  public explorationCoordinator: ExplorationCoordinator | null = null;

  // Active grid session — when set, all browser operations delegate to this session
  private activeGridSession: GridSession | null = null;
  public activeSessionId: string | null = null;

  // BiDi event collection
  public eventCollector: EventCollector | null = null;

  // Session tracing
  public tracer: SessionTracer | null = null;

  constructor(config: BrowserConfig = {}) {
    this.config = {
      headless: false,
      windowSize: { width: 1280, height: 720 },
      ...config
    };
  }

  getStealthEnabled(): boolean {
    return this.config.stealth ?? false;
  }

  getOutputMode(): 'stdout' | 'file' {
    return this.config.outputMode ?? 'stdout';
  }

  setStealthEnabled(enabled: boolean): void {
    this.config.stealth = enabled;
  }

  isBrowserRunning(): boolean {
    return this.driver !== null;
  }

  getGridUrl(): string | null {
    return process.env.SELENIUM_GRID_URL || null;
  }

  async ensureGrid(): Promise<{ pool: SessionPool; coordinator: ExplorationCoordinator; client: GridClient }> {
    const gridUrl = this.getGridUrl();
    if (!gridUrl) {
      throw new Error('SELENIUM_GRID_URL environment variable is not set. Start a Selenium Grid and set the URL (e.g. http://localhost:4444).');
    }

    if (!this.gridClient || !this.sessionPool || !this.explorationCoordinator) {
      const { GridClient: GC } = await import('./grid/grid-client.js');
      const { SessionPool: SP } = await import('./grid/session-pool.js');
      const { ExplorationCoordinator: EC } = await import('./grid/exploration-coordinator.js');
      this.gridClient = new GC(gridUrl);
      this.sessionPool = new SP(gridUrl);
      this.explorationCoordinator = new EC(this.sessionPool);
    }

    return {
      pool: this.sessionPool!,
      coordinator: this.explorationCoordinator!,
      client: this.gridClient!,
    };
  }

  /**
   * Select a grid session to become the active browser context.
   * All subsequent tool calls will operate against this session.
   * Pass null to deselect and return to the local browser.
   */
  selectSession(sessionId: string | null): void {
    if (sessionId === null) {
      this.activeGridSession = null;
      this.activeSessionId = null;
      return;
    }
    if (!this.sessionPool) {
      throw new Error('Grid not initialized. Call ensureGrid() first or set SELENIUM_GRID_URL.');
    }
    const session = this.sessionPool.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found. Use session_list to see available sessions.`);
    }
    this.activeGridSession = session;
    this.activeSessionId = sessionId;
  }

  async ensureBrowser(): Promise<WebDriver> {
    if (this.activeGridSession) {
      return this.activeGridSession.getDriver();
    }
    if (!this.driver) {
      const options = buildChromeOptions(this.config);

      const builder = new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options);

      // Always enable BiDi WebSocket — needed for stealth, screenshots, PDF, event collection
      builder.withCapabilities({ webSocketUrl: true });

      this.driver = await builder.build();

      if (this.config.stealth) {
        await applyStealthScripts(this.driver);
      }

      // Start BiDi event collection
      try {
        this.eventCollector = new EventCollector();
        await this.eventCollector.subscribe(this.driver);
      } catch {
        this.eventCollector = null;
      }
    }
    return this.driver;
  }

  async getDriver(): Promise<WebDriver> {
    if (this.activeGridSession) {
      return this.activeGridSession.getDriver();
    }
    if (!this.driver) {
      throw new Error('Browser not started. Call ensureBrowser() first.');
    }
    return this.driver;
  }

  async captureSnapshot(options?: SnapshotOptions): Promise<PageSnapshot> {
    if (this.activeGridSession) {
      return this.activeGridSession.captureSnapshot(options);
    }

    const driver = await this.getDriver();

    const url = await driver.getCurrentUrl();
    const title = await driver.getTitle();
    const elements = await discoverElements(driver, options?.selector);

    this.snapshot = {
      url,
      title,
      elements,
      timestamp: Date.now()
    };
    return this.snapshot;
  }

  async getSnapshot(): Promise<PageSnapshot> {
    if (this.activeGridSession) {
      const existing = this.activeGridSession.getSnapshot();
      if (existing) return existing;
      return this.activeGridSession.captureSnapshot();
    }

    if (!this.snapshot) {
      return this.captureSnapshot();
    }
    return this.snapshot;
  }

  formatSnapshotAsText(options?: SnapshotOptions): string {
    if (this.activeGridSession) {
      return this.activeGridSession.formatSnapshotAsText(options);
    }

    if (!this.snapshot) {
      return 'No snapshot available';
    }

    const lines: string[] = [
      `Page: ${this.snapshot.title}`,
      `URL: ${this.snapshot.url}`,
      '',
      'Interactive Elements:'
    ];

    for (const [ref, info] of this.snapshot.elements) {
      const label = info.ariaLabel || info.text || info.tagName;
      lines.push(`  [${ref}] ${info.tagName}: ${label.slice(0, 50)}`);
    }

    let text = lines.join('\n');

    if (options?.maxLength && text.length > options.maxLength) {
      text = text.slice(0, options.maxLength) + '\n... (truncated)';
    }

    return text;
  }

  async getElementByRef(ref: string): Promise<WebElement> {
    if (this.activeGridSession) {
      return this.activeGridSession.getElementByRef(ref);
    }

    const snapshot = await this.getSnapshot();
    const info = snapshot.elements.get(ref);

    if (!info) {
      throw new Error(`Element ref not found: ${ref}. Available refs: ${Array.from(snapshot.elements.keys()).join(', ')}`);
    }

    const driver = await this.getDriver();
    return findElementByInfo(driver, info);
  }

  async getTabs(): Promise<TabInfo[]> {
    const driver = await this.getDriver();
    const handles = await driver.getAllWindowHandles();
    const currentHandle = await driver.getWindowHandle();
    const tabs: TabInfo[] = [];

    for (const handle of handles) {
      await driver.switchTo().window(handle);
      tabs.push({
        handle,
        title: await driver.getTitle(),
        url: await driver.getCurrentUrl(),
        isActive: handle === currentHandle
      });
    }

    // Switch back to original
    await driver.switchTo().window(currentHandle);
    return tabs;
  }

  async switchToTab(handle: string): Promise<void> {
    const driver = await this.getDriver();
    await driver.switchTo().window(handle);
    this.snapshot = null;
    this.previousSnapshotText = null;
  }

  async close(): Promise<void> {
    // Clear active session selection
    this.activeGridSession = null;
    this.activeSessionId = null;

    // Clean up grid sessions first
    if (this.sessionPool) {
      try {
        await this.sessionPool.destroyAll();
      } catch { /* best effort */ }
      this.sessionPool = null;
      this.gridClient = null;
      this.explorationCoordinator = null;
    }

    // Save trace if active
    if (this.tracer && this.tracer.entryCount > 0) {
      try { await this.tracer.save(); } catch { /* best effort */ }
    }

    // Clean up event collector
    this.eventCollector = null;

    if (this.driver) {
      await this.driver.quit();
      this.driver = null;
      this.snapshot = null;
      this.consoleLogs = [];
      this.previousSnapshotText = null;
      this.generatorFramework = null;
    }
  }

  // Recording methods
  recordAction(tool: string, params: Record<string, unknown>): void {
    if (this.recordingEnabled) {
      // Enrich with element locator info from current snapshot (just Map lookups, no browser calls)
      const elements = this.resolveElementLocators(params);

      this.actionHistory.push({
        tool,
        params,
        timestamp: Date.now(),
        elements: Object.keys(elements).length > 0 ? elements : undefined,
      });
    }
  }

  private resolveElementLocators(params: Record<string, unknown>): Record<string, ElementLocator> {
    const locators: Record<string, ElementLocator> = {};
    if (!this.snapshot) return locators;

    // Look for ref-like params (ref, sourceRef, targetRef, fromRef, toRef)
    const refKeys = ['ref', 'sourceRef', 'targetRef', 'fromRef', 'toRef', 'from_ref', 'to_ref'];
    for (const key of refKeys) {
      const ref = params[key];
      if (typeof ref === 'string' && this.snapshot.elements.has(ref)) {
        const info = this.snapshot.elements.get(ref)!;
        locators[ref] = {
          tagName: info.tagName,
          id: info.attributes['id'] || undefined,
          name: info.attributes['name'] || undefined,
          text: info.text || undefined,
          ariaLabel: info.ariaLabel || undefined,
          type: info.attributes['type'] || undefined,
          placeholder: info.attributes['placeholder'] || undefined,
          href: info.attributes['href'] || undefined,
        };
      }
    }

    return locators;
  }

  startRecording(): void {
    this.recordingEnabled = true;
    this.actionHistory = [];
    this.generatorFramework = null;
  }

  stopRecording(): void {
    this.recordingEnabled = false;
  }

  clearRecording(): void {
    this.actionHistory = [];
  }

  getRecordingStatus(): { enabled: boolean; actionCount: number } {
    return {
      enabled: this.recordingEnabled,
      actionCount: this.actionHistory.length
    };
  }

  async reset(): Promise<void> {
    await this.close();
    await this.ensureBrowser();
  }

  getConsoleLogs(options?: ConsoleOptions): ConsoleLogEntry[] {
    let logs = [...this.consoleLogs];

    if (options?.levels && options.levels.length > 0) {
      const allowedLevels = new Set(options.levels);
      logs = logs.filter(log => allowedLevels.has(log.level as 'error' | 'warn' | 'info' | 'log'));
    }

    if (options?.maxMessages && options.maxMessages > 0) {
      logs = logs.slice(-options.maxMessages);
    }

    return logs;
  }

  async captureSnapshotWithDiff(options?: SnapshotOptions, diffOptions?: DiffOptions): Promise<{ snapshot: string; diff: string | null }> {
    if (this.activeGridSession) {
      await this.activeGridSession.captureSnapshot(options);
      const currentText = this.activeGridSession.formatSnapshotAsText(options);
      // Grid sessions don't track previous snapshot text for diffs yet
      return { snapshot: currentText, diff: null };
    }

    await this.captureSnapshot(options);
    const currentText = this.formatSnapshotAsText(options);

    let diff: string | null = null;

    if (diffOptions?.enabled && this.previousSnapshotText) {
      if (diffOptions.format === 'unified') {
        diff = this.computeUnifiedDiff(this.previousSnapshotText, currentText);
      } else {
        diff = this.computeMinimalDiff(this.previousSnapshotText, currentText);
      }
    }

    this.previousSnapshotText = currentText;

    return { snapshot: currentText, diff };
  }

  private computeMinimalDiff(prev: string, curr: string): string {
    const prevLines = new Set(prev.split('\n'));
    const currLines = new Set(curr.split('\n'));

    const added: string[] = [];
    const removed: string[] = [];

    for (const line of currLines) {
      if (!prevLines.has(line)) {
        added.push(`[ADDED] ${line}`);
      }
    }

    for (const line of prevLines) {
      if (!currLines.has(line)) {
        removed.push(`[REMOVED] ${line}`);
      }
    }

    if (added.length === 0 && removed.length === 0) {
      return '[NO CHANGES]';
    }

    return [...removed, ...added].join('\n');
  }

  private computeUnifiedDiff(prev: string, curr: string): string {
    const prevLines = prev.split('\n');
    const currLines = curr.split('\n');

    const output: string[] = ['--- previous', '+++ current'];

    const maxLen = Math.max(prevLines.length, currLines.length);
    for (let i = 0; i < maxLen; i++) {
      const prevLine = i < prevLines.length ? prevLines[i] : undefined;
      const currLine = i < currLines.length ? currLines[i] : undefined;

      if (prevLine === currLine) {
        output.push(` ${prevLine}`);
      } else {
        if (prevLine !== undefined) {
          output.push(`-${prevLine}`);
        }
        if (currLine !== undefined) {
          output.push(`+${currLine}`);
        }
      }
    }

    return output.join('\n');
  }

}
