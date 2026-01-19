import { Builder, WebDriver, By, until, WebElement } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { PageSnapshot, ElementInfo, BrowserConfig, TabInfo, ConsoleLogEntry } from './types.js';

// Action recorded during session
export interface RecordedAction {
  tool: string;
  params: Record<string, unknown>;
  timestamp: number;
}

// Analysis session for regression analyzer
export interface AnalysisSession {
  productName: string;
  productSlug: string;
  url: string;
  domainType: string | null;
  useDomainTemplate: boolean;
  domainTemplate: DomainTemplate | null;
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

export interface DomainTemplate {
  domain?: { description?: string };
  processes?: Record<string, ProcessDefinition>;
  features?: Record<string, FeatureDefinition>;
}

export interface ProcessDefinition {
  name?: string;
  description?: string;
  risk?: string;
  steps?: ProcessStep[];
}

export interface ProcessStep {
  name: string;
  action: string;
  selector?: string;
  url?: string;
}

export interface FeatureDefinition {
  risk?: string;
  compliance?: string[];
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

  // Recording state
  public recordingEnabled = false;
  public actionHistory: RecordedAction[] = [];

  // Analysis session for regression analyzer
  public analysisSession: AnalysisSession | null = null;

  constructor(config: BrowserConfig = {}) {
    this.config = {
      headless: false,
      windowSize: { width: 1280, height: 720 },
      ...config
    };
  }

  async ensureBrowser(): Promise<WebDriver> {
    if (!this.driver) {
      const options = new chrome.Options();
      options.addArguments('--no-sandbox');
      options.addArguments('--disable-dev-shm-usage');

      if (this.config.headless) {
        options.addArguments('--headless=new');
      }

      if (this.config.windowSize) {
        options.addArguments(`--window-size=${this.config.windowSize.width},${this.config.windowSize.height}`);
      }

      if (this.config.userAgent) {
        options.addArguments(`--user-agent=${this.config.userAgent}`);
      }

      this.driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
    }
    return this.driver;
  }

  async getDriver(): Promise<WebDriver> {
    if (!this.driver) {
      throw new Error('Browser not started. Call ensureBrowser() first.');
    }
    return this.driver;
  }

  async captureSnapshot(): Promise<PageSnapshot> {
    const driver = await this.getDriver();

    const url = await driver.getCurrentUrl();
    const title = await driver.getTitle();
    const elements = await this.discoverElements(driver);

    this.snapshot = {
      url,
      title,
      elements,
      timestamp: Date.now()
    };
    return this.snapshot;
  }

  async getSnapshot(): Promise<PageSnapshot> {
    if (!this.snapshot) {
      return this.captureSnapshot();
    }
    return this.snapshot;
  }

  formatSnapshotAsText(): string {
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

    return lines.join('\n');
  }

  async getElementByRef(ref: string): Promise<WebElement> {
    const snapshot = await this.getSnapshot();
    const info = snapshot.elements.get(ref);

    if (!info) {
      throw new Error(`Element ref not found: ${ref}. Available refs: ${Array.from(snapshot.elements.keys()).join(', ')}`);
    }

    const driver = await this.getDriver();
    return this.findElement(driver, info);
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
    this.snapshot = null; // Clear snapshot when switching tabs
  }

  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.quit();
      this.driver = null;
      this.snapshot = null;
      this.consoleLogs = [];
    }
  }

  // Recording methods
  recordAction(tool: string, params: Record<string, unknown>): void {
    if (this.recordingEnabled) {
      this.actionHistory.push({
        tool,
        params,
        timestamp: Date.now()
      });
    }
  }

  startRecording(): void {
    this.recordingEnabled = true;
    this.actionHistory = [];
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

  private async discoverElements(driver: WebDriver): Promise<Map<string, ElementInfo>> {
    const elements = new Map<string, ElementInfo>();

    // Find all interactive elements
    const interactiveElements = await driver.findElements(
      By.css('a, button, input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [onclick], [tabindex]')
    );

    let refCount = 1;
    for (const el of interactiveElements.slice(0, 100)) {
      try {
        const isDisplayed = await el.isDisplayed();
        if (!isDisplayed) continue;

        const ref = `e${refCount++}`;
        const info = await this.extractElementInfo(el, ref);
        elements.set(ref, info);
      } catch {
        // Element might be stale, skip it
        continue;
      }
    }

    return elements;
  }

  private async extractElementInfo(el: WebElement, ref: string): Promise<ElementInfo> {
    const tagName = await el.getTagName();
    const text = await el.getText();
    const ariaLabel = await el.getAttribute('aria-label');
    const id = await el.getAttribute('id');
    const name = await el.getAttribute('name');
    const type = await el.getAttribute('type');
    const href = await el.getAttribute('href');
    const placeholder = await el.getAttribute('placeholder');

    const rect = await el.getRect();
    const isClickable = ['a', 'button', 'input'].includes(tagName.toLowerCase()) ||
                        (await el.getAttribute('onclick')) !== null ||
                        (await el.getAttribute('role')) === 'button';

    const attributes: Record<string, string> = {};
    if (id) attributes['id'] = id;
    if (name) attributes['name'] = name;
    if (type) attributes['type'] = type;
    if (href) attributes['href'] = href;
    if (placeholder) attributes['placeholder'] = placeholder;

    return {
      ref,
      tagName,
      text: text.slice(0, 100),
      ariaLabel: ariaLabel || undefined,
      isClickable,
      isVisible: true,
      attributes,
      boundingBox: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      }
    };
  }

  private async findElement(driver: WebDriver, info: ElementInfo): Promise<WebElement> {
    // Try multiple strategies to find the element

    // 1. Try by ID
    if (info.attributes['id']) {
      try {
        const el = await driver.findElement(By.id(info.attributes['id']));
        if (await el.isDisplayed()) return el;
      } catch { /* continue to next strategy */ }
    }

    // 2. Try by name
    if (info.attributes['name']) {
      try {
        const el = await driver.findElement(By.name(info.attributes['name']));
        if (await el.isDisplayed()) return el;
      } catch { /* continue to next strategy */ }
    }

    // 3. Try by text content (for buttons/links)
    if (info.text && ['a', 'button'].includes(info.tagName.toLowerCase())) {
      try {
        const el = await driver.findElement(By.xpath(`//${info.tagName}[contains(text(), "${info.text.slice(0, 30)}")]`));
        if (await el.isDisplayed()) return el;
      } catch { /* continue to next strategy */ }
    }

    // 4. Try by aria-label
    if (info.ariaLabel) {
      try {
        const el = await driver.findElement(By.css(`[aria-label="${info.ariaLabel}"]`));
        if (await el.isDisplayed()) return el;
      } catch { /* continue to next strategy */ }
    }

    // 5. Fall back to position-based search
    const elements = await driver.findElements(By.tagName(info.tagName));
    for (const el of elements) {
      try {
        const rect = await el.getRect();
        if (info.boundingBox &&
            Math.abs(rect.x - info.boundingBox.x) < 10 &&
            Math.abs(rect.y - info.boundingBox.y) < 10) {
          return el;
        }
      } catch { /* continue */ }
    }

    throw new Error(`Could not find element: ${info.ref} (${info.tagName})`);
  }
}
