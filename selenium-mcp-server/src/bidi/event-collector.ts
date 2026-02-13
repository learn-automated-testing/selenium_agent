import { WebDriver } from 'selenium-webdriver';

export interface BiDiConsoleEvent {
  level: string;
  text: string;
  timestamp: number;
  source?: string;
}

export interface BiDiNetworkEvent {
  url: string;
  method: string;
  status?: number;
  type: 'request' | 'response' | 'error';
  timestamp: number;
  mimeType?: string;
  duration?: number;
}

export interface BiDiNavigationEvent {
  url: string;
  type: 'started' | 'completed' | 'failed';
  timestamp: number;
}

export interface BiDiDialogEvent {
  type: string;
  message: string;
  timestamp: number;
}

const MAX_BUFFER_SIZE = 500;

/**
 * Subscribes to BiDi events (console, network, navigation, dialog) and
 * stores them in circular buffers. Graceful degradation: each subscription
 * is wrapped in try/catch so partial availability is fine.
 */
export class EventCollector {
  private consoleEvents: BiDiConsoleEvent[] = [];
  private networkEvents: BiDiNetworkEvent[] = [];
  private navigationEvents: BiDiNavigationEvent[] = [];
  private dialogEvents: BiDiDialogEvent[] = [];

  private _isActive = false;
  private pendingRequests = new Map<string, { url: string; method: string; timestamp: number }>();

  get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Subscribe to all available BiDi event channels.
   * Each subscription is independent — partial failure is OK.
   */
  async subscribe(driver: WebDriver): Promise<void> {
    let anySubscribed = false;

    // Console events via LogInspector
    try {
      const logInspectorMod = await import('selenium-webdriver/bidi/logInspector.js');
      const logInspector = await logInspectorMod.default(driver);

      await logInspector.onConsoleEntry((entry: any) => {
        this.pushConsole({
          level: entry.level ?? 'info',
          text: entry.text ?? String(entry.args?.[0]?.value ?? ''),
          timestamp: Date.now(),
          source: entry.stackTrace?.callFrames?.[0]?.url,
        });
      });
      anySubscribed = true;
    } catch { /* LogInspector not available */ }

    // Network events
    try {
      // @ts-ignore — selenium-webdriver/bidi/network.js lacks type declarations
      const networkMod = await import('selenium-webdriver/bidi/network.js');
      const network = await networkMod.default(driver);

      await network.beforeRequestSent((event: any) => {
        const requestId = event.request?.request ?? String(Date.now());
        const url = event.request?.url ?? '';
        const method = event.request?.method ?? 'GET';
        this.pendingRequests.set(requestId, { url, method, timestamp: Date.now() });
        this.pushNetwork({
          url,
          method,
          type: 'request',
          timestamp: Date.now(),
        });
      });

      await network.responseCompleted((event: any) => {
        const requestId = event.request?.request ?? '';
        const pending = this.pendingRequests.get(requestId);
        const url = event.request?.url ?? pending?.url ?? '';
        const method = pending?.method ?? 'GET';
        const duration = pending ? Date.now() - pending.timestamp : undefined;
        this.pendingRequests.delete(requestId);

        this.pushNetwork({
          url,
          method,
          status: event.response?.status,
          type: 'response',
          timestamp: Date.now(),
          mimeType: event.response?.mimeType,
          duration,
        });
      });
      anySubscribed = true;
    } catch { /* Network not available */ }

    // Browsing context events (navigation)
    try {
      const browsingContextMod = await import('selenium-webdriver/bidi/browsingContext.js');
      const windowHandle = await driver.getWindowHandle();
      const bc = await browsingContextMod.default(driver, { browsingContextId: windowHandle });

      // Navigation started — not all browsers support this event
      try {
        await (bc as any).onNavigationStarted((event: any) => {
          this.pushNavigation({
            url: event.url ?? '',
            type: 'started',
            timestamp: Date.now(),
          });
        });
      } catch { /* event not supported */ }

      anySubscribed = true;
    } catch { /* BrowsingContext not available */ }

    this._isActive = anySubscribed;
  }

  getConsoleEvents(): BiDiConsoleEvent[] {
    return [...this.consoleEvents];
  }

  getNetworkEvents(): BiDiNetworkEvent[] {
    return [...this.networkEvents];
  }

  getNavigationEvents(): BiDiNavigationEvent[] {
    return [...this.navigationEvents];
  }

  getDialogEvents(): BiDiDialogEvent[] {
    return [...this.dialogEvents];
  }

  getNetworkSummary(): string {
    const responses = this.networkEvents.filter(e => e.type === 'response');
    if (responses.length === 0) return '';

    const lines = responses.slice(-20).map(r => {
      const status = r.status ?? '???';
      const duration = r.duration ? ` (${r.duration}ms)` : '';
      return `${r.method} ${status} ${r.url}${duration}`;
    });

    return `Recent network (${responses.length} total, showing last ${lines.length}):\n${lines.join('\n')}`;
  }

  clear(): void {
    this.consoleEvents = [];
    this.networkEvents = [];
    this.navigationEvents = [];
    this.dialogEvents = [];
    this.pendingRequests.clear();
  }

  private pushConsole(event: BiDiConsoleEvent): void {
    this.consoleEvents.push(event);
    if (this.consoleEvents.length > MAX_BUFFER_SIZE) {
      this.consoleEvents.shift();
    }
  }

  private pushNetwork(event: BiDiNetworkEvent): void {
    this.networkEvents.push(event);
    if (this.networkEvents.length > MAX_BUFFER_SIZE) {
      this.networkEvents.shift();
    }
  }

  private pushNavigation(event: BiDiNavigationEvent): void {
    this.navigationEvents.push(event);
    if (this.navigationEvents.length > MAX_BUFFER_SIZE) {
      this.navigationEvents.shift();
    }
  }
}
