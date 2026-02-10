import { WebDriver, WebElement } from 'selenium-webdriver';
import { Context } from '../context.js';
import { PageSnapshot, SnapshotOptions, DiffOptions } from '../types.js';
import { GridSession } from './grid-session.js';

/**
 * SessionContext extends Context, delegating all browser operations to a GridSession.
 * This allows existing tools (which call context.ensureBrowser(), context.getDriver(), etc.)
 * to work unchanged against remote grid sessions.
 */
export class SessionContext extends Context {
  private gridSession: GridSession;

  constructor(gridSession: GridSession) {
    super();
    this.gridSession = gridSession;
  }

  override async ensureBrowser(): Promise<WebDriver> {
    return this.gridSession.getDriver();
  }

  override async getDriver(): Promise<WebDriver> {
    return this.gridSession.getDriver();
  }

  override async captureSnapshot(options?: SnapshotOptions): Promise<PageSnapshot> {
    return this.gridSession.captureSnapshot(options);
  }

  override async getSnapshot(): Promise<PageSnapshot> {
    const existing = this.gridSession.getSnapshot();
    if (existing) return existing;
    return this.gridSession.captureSnapshot();
  }

  override formatSnapshotAsText(options?: SnapshotOptions): string {
    return this.gridSession.formatSnapshotAsText(options);
  }

  override async getElementByRef(ref: string): Promise<WebElement> {
    return this.gridSession.getElementByRef(ref);
  }

  override async captureSnapshotWithDiff(
    options?: SnapshotOptions,
    diffOptions?: DiffOptions
  ): Promise<{ snapshot: string; diff: string | null }> {
    // Capture snapshot via grid session, then compute diff using parent's logic
    await this.gridSession.captureSnapshot(options);
    const currentText = this.gridSession.formatSnapshotAsText(options);
    return { snapshot: currentText, diff: null };
  }

  // close() is a no-op — the pool manages grid session lifecycle
  override async close(): Promise<void> {
    // Intentionally empty
  }
}
