import { Builder } from 'selenium-webdriver';
import { GridSessionInfo, GridSessionCapabilities, BrowserConfig } from '../types.js';
import { GridSession } from './grid-session.js';
import { buildChromeOptions, applyStealthScripts } from '../utils/chrome-options.js';

let sessionCounter = 0;

export class SessionPool {
  private sessions = new Map<string, GridSession>();
  private gridUrl: string;

  constructor(gridUrl: string) {
    this.gridUrl = gridUrl.replace(/\/+$/, '');
  }

  async createSession(
    capabilities?: GridSessionCapabilities,
    sessionId?: string,
    tags: string[] = [],
    config?: BrowserConfig,
  ): Promise<GridSession> {
    const browserName = capabilities?.browserName || 'chrome';
    const id = sessionId || `grid-${++sessionCounter}`;
    const stealth = config?.stealth ?? (process.env.SELENIUM_STEALTH === 'true');

    if (this.sessions.has(id)) {
      throw new Error(`Session "${id}" already exists`);
    }

    const builder = new Builder()
      .usingServer(`${this.gridUrl}/wd/hub`);

    // For Chrome: use shared options builder (includes stealth when enabled)
    if (browserName === 'chrome') {
      const chromeOpts = buildChromeOptions({ stealth });
      builder.setChromeOptions(chromeOpts);
    }

    const caps: Record<string, unknown> = { browserName, ...capabilities };

    // BiDi WebSocket is required for stealth preload scripts
    if (stealth) {
      caps.webSocketUrl = true;
    }

    builder.withCapabilities(caps);

    const driver = await builder.build();

    if (stealth) {
      await applyStealthScripts(driver, this.gridUrl);
    }

    const session = new GridSession(id, driver, browserName, tags);

    this.sessions.set(id, session);
    return session;
  }

  getSession(sessionId: string): GridSession | undefined {
    return this.sessions.get(sessionId);
  }

  listSessions(tags?: string[]): GridSessionInfo[] {
    const sessions = Array.from(this.sessions.values());
    if (!tags || tags.length === 0) {
      return sessions.map(s => s.toInfo());
    }

    return sessions
      .filter(s => tags.some(t => s.tags.includes(t)))
      .map(s => s.toInfo());
  }

  async destroySession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    await session.close();
    this.sessions.delete(sessionId);
    return true;
  }

  async destroyAll(tags?: string[]): Promise<number> {
    const toDestroy: [string, GridSession][] = [];

    for (const [id, session] of this.sessions) {
      if (!tags || tags.length === 0 || tags.some(t => session.tags.includes(t))) {
        toDestroy.push([id, session]);
      }
    }

    const results = await Promise.allSettled(
      toDestroy.map(async ([id, session]) => {
        await session.close();
        this.sessions.delete(id);
      })
    );

    return results.filter(r => r.status === 'fulfilled').length;
  }

  get size(): number {
    return this.sessions.size;
  }
}
