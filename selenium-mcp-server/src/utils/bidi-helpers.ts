import { WebDriver } from 'selenium-webdriver';

/**
 * Rewrite the BiDi WebSocket URL when running through a Selenium Grid.
 * The webSocketUrl capability contains the node's internal Docker IP which
 * is unreachable from the host. This rewrites the host portion to route
 * through the grid hub instead.
 */
export async function rewriteBidiWebSocketUrl(driver: WebDriver, gridUrl: string): Promise<void> {
  const caps = await driver.getCapabilities();
  const wsUrl = caps.get('webSocketUrl') as string | undefined;
  if (wsUrl) {
    const hubHost = new URL(gridUrl).host;
    const corrected = wsUrl.replace(/^ws:\/\/[^/]+/, `ws://${hubHost}`);
    (caps as unknown as { map_: Map<string, unknown> }).map_.set('webSocketUrl', corrected);
  }
}

/**
 * Get a BiDi browsing context for the driver's current window.
 * Returns null if BiDi is not available (graceful degradation).
 */
export async function getBidiContext(driver: WebDriver): Promise<{ browsingContext: any; scriptManager: any } | null> {
  try {
    const caps = await driver.getCapabilities();
    const wsUrl = caps.get('webSocketUrl') as string | undefined;
    if (!wsUrl) return null;

    const browsingContextMod = await import('selenium-webdriver/bidi/browsingContext.js');
    const scriptManagerMod = await import('selenium-webdriver/bidi/scriptManager.js');

    const windowHandle = await driver.getWindowHandle();
    const browsingContext = await browsingContextMod.default(driver, { browsingContextId: windowHandle });
    const scriptManager = await scriptManagerMod.default(null as any, driver as any);

    return { browsingContext, scriptManager };
  } catch {
    return null;
  }
}
