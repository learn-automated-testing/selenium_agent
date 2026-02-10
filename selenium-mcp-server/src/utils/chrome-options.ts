import chrome from 'selenium-webdriver/chrome.js';
import { WebDriver } from 'selenium-webdriver';
import { BrowserConfig } from '../types.js';

/** Chrome prefs that suppress xdg-open dialogs for non-HTTP protocols. */
const EXCLUDED_SCHEMES: Record<string, unknown> = {
  afp: true, data: true, disk: true, disks: true, file: true,
  hcp: true, intent: true, 'itms-appss': true, 'itms-apps': true,
  itms: true, market: true, javascript: true, mailto: true,
  'ms-help': true, news: true, nntp: true, shell: true, sip: true,
  snews: true, tel: true, vbscript: true, 'view-source': true,
};

/**
 * Build Chrome options from a BrowserConfig.
 * Centralizes option construction used by both Context and SessionPool.
 */
export function buildChromeOptions(config: BrowserConfig): chrome.Options {
  const options = new chrome.Options();

  // Baseline args
  options.addArguments('--no-sandbox', '--disable-dev-shm-usage');

  // Protocol handler suppression
  const prefs: Record<string, unknown> = {
    'protocol_handler.excluded_schemes': EXCLUDED_SCHEMES,
  };

  // Stealth-specific options
  if (config.stealth) {
    options.addArguments('--disable-blink-features=AutomationControlled');
    options.excludeSwitches('enable-automation');

    // Disable password manager / credential service popups
    prefs['credentials_enable_service'] = false;
    prefs['profile.password_manager_enabled'] = false;
  }

  options.setUserPreferences(prefs);

  if (config.headless) {
    options.addArguments('--headless=new');
  }

  if (config.windowSize) {
    options.addArguments(`--window-size=${config.windowSize.width},${config.windowSize.height}`);
  }

  if (config.userAgent) {
    options.addArguments(`--user-agent=${config.userAgent}`);
  }

  return options;
}

/**
 * Stealth preload function injected via WebDriver BiDi `script.addPreloadScript`.
 * Runs before every new document to mask automation indicators.
 * Wrapped as an IIFE string because BiDi expects a function declaration.
 */
const STEALTH_PRELOAD_FUNCTION = `() => {
  // 1. Remove navigator.webdriver flag
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
  });

  // 2. Patch navigator.plugins to report a non-empty length
  Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5],
  });

  // 3. Set realistic languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
  });

  // 4. Ensure window.chrome.runtime exists (absent in headless / automation)
  if (!window.chrome) {
    window.chrome = {};
  }
  if (!window.chrome.runtime) {
    window.chrome.runtime = {};
  }
}`;

/**
 * Inject preload scripts via WebDriver BiDi that mask automation indicators.
 * Works on both Chrome and Firefox.
 *
 * The driver must have been built with the `webSocketUrl: true` capability.
 * Must be called right after the driver is built and before any navigation.
 *
 * @param gridUrl  When running on a Selenium Grid, pass the hub URL so the
 *                 BiDi WebSocket routes through the hub instead of trying to
 *                 reach the node's internal Docker IP directly.
 */
export async function applyStealthScripts(driver: WebDriver, gridUrl?: string): Promise<void> {
  // When running through a grid, the webSocketUrl capability contains the
  // node's internal Docker IP which is unreachable from the host.  Rewrite
  // the host portion to route through the grid hub instead.
  if (gridUrl) {
    const caps = await driver.getCapabilities();
    const wsUrl = caps.get('webSocketUrl') as string | undefined;
    if (wsUrl) {
      const hubHost = new URL(gridUrl).host;
      const corrected = wsUrl.replace(/^ws:\/\/[^/]+/, `ws://${hubHost}`);
      // Capabilities are backed by a Map; overwrite the entry so getBidi()
      // connects through the hub.
      (caps as unknown as { map_: Map<string, unknown> }).map_.set('webSocketUrl', corrected);
    }
  }

  const createScriptManager = (await import('selenium-webdriver/bidi/scriptManager.js')).default;
  // Type definitions are inaccurate: browsingContextId accepts null (= all contexts)
  // and addPreloadScript accepts a string function declaration over the BiDi protocol.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const manager = await createScriptManager(null as any, driver as any);
  await manager.addPreloadScript(STEALTH_PRELOAD_FUNCTION as unknown as (...args: unknown[]) => unknown);
}
