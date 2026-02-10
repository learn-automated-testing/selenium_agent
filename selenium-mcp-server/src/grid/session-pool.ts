import { Builder } from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome.js';
import { GridSessionInfo, GridSessionCapabilities } from '../types.js';
import { GridSession } from './grid-session.js';

/** Chrome prefs that suppress xdg-open dialogs for non-HTTP protocols in Docker/Linux. */
const EXCLUDED_SCHEMES: Record<string, unknown> = {
  afp: true, data: true, disk: true, disks: true, file: true,
  hcp: true, intent: true, 'itms-appss': true, 'itms-apps': true,
  itms: true, market: true, javascript: true, mailto: true,
  'ms-help': true, news: true, nntp: true, shell: true, sip: true,
  snews: true, tel: true, vbscript: true, 'view-source': true,
};

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
    tags: string[] = []
  ): Promise<GridSession> {
    const browserName = capabilities?.browserName || 'chrome';
    const id = sessionId || `grid-${++sessionCounter}`;

    if (this.sessions.has(id)) {
      throw new Error(`Session "${id}" already exists`);
    }

    const builder = new Builder()
      .usingServer(`${this.gridUrl}/wd/hub`);

    // For Chrome: set options that suppress xdg-open protocol handler dialogs
    if (browserName === 'chrome') {
      const chromeOpts = new chrome.Options();
      chromeOpts.setUserPreferences({
        'protocol_handler.excluded_schemes': EXCLUDED_SCHEMES,
      });
      chromeOpts.addArguments('--no-sandbox', '--disable-dev-shm-usage');
      builder.setChromeOptions(chromeOpts);
    }

    builder.withCapabilities({ browserName, ...capabilities });

    const driver = await builder.build();
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
