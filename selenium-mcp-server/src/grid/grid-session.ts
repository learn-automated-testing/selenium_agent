import { WebDriver, WebElement } from 'selenium-webdriver';
import { PageSnapshot, ElementInfo, GridSessionInfo, SnapshotOptions } from '../types.js';
import { discoverElements, findElementByInfo } from '../utils/element-discovery.js';

export class GridSession {
  readonly sessionId: string;
  readonly browser: string;
  readonly tags: string[];
  readonly createdAt: number;

  private driver: WebDriver;
  private snapshot: PageSnapshot | null = null;
  private previousSnapshotText: string | null = null;

  constructor(
    sessionId: string,
    driver: WebDriver,
    browser: string,
    tags: string[] = []
  ) {
    this.sessionId = sessionId;
    this.driver = driver;
    this.browser = browser;
    this.tags = tags;
    this.createdAt = Date.now();
  }

  getDriver(): WebDriver {
    return this.driver;
  }

  async captureSnapshot(options?: SnapshotOptions): Promise<PageSnapshot> {
    const url = await this.driver.getCurrentUrl();
    const title = await this.driver.getTitle();
    const elements = await discoverElements(this.driver, options?.selector);

    this.snapshot = { url, title, elements, timestamp: Date.now() };
    return this.snapshot;
  }

  getSnapshot(): PageSnapshot | null {
    return this.snapshot;
  }

  formatSnapshotAsText(options?: SnapshotOptions): string {
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
    if (!this.snapshot) {
      await this.captureSnapshot();
    }

    const info = this.snapshot!.elements.get(ref);
    if (!info) {
      throw new Error(`Element ref not found: ${ref}. Available refs: ${Array.from(this.snapshot!.elements.keys()).join(', ')}`);
    }

    return findElementByInfo(this.driver, info);
  }

  async close(): Promise<void> {
    try {
      await this.driver.quit();
    } catch {
      // Best effort — driver may already be closed
    }
    this.snapshot = null;
    this.previousSnapshotText = null;
  }

  toInfo(): GridSessionInfo {
    return {
      sessionId: this.sessionId,
      browser: this.browser,
      tags: [...this.tags],
      createdAt: this.createdAt,
      url: this.snapshot?.url,
      title: this.snapshot?.title,
    };
  }
}
