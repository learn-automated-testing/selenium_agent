/**
 * Helpers for detecting and recovering from a browser session that died
 * underneath the server: the user closed the window, the browser crashed,
 * chromedriver exited while the machine slept, or a grid reaped the session.
 */

/** How long a liveness probe may take before the session is treated as dead. */
export const SESSION_PROBE_TIMEOUT_MS = 5000;

const SESSION_LOST_PATTERNS = [
  /invalid session id/i,
  /no such session/i,
  /session deleted/i,
  /chrome not reachable/i,
  /disconnected: not connected to devtools/i,
  /target window already closed/i,
  /ECONNREFUSED/,
];

/**
 * True when an error means the WebDriver session is gone and every further
 * command on it will fail the same way.
 */
export function isSessionLostError(err: unknown): boolean {
  if (!err) return false;
  const name = (err as { name?: string }).name ?? '';
  if (name === 'NoSuchSessionError') return true;
  const message = err instanceof Error ? err.message : String(err);
  return SESSION_LOST_PATTERNS.some(pattern => pattern.test(message));
}

/** Reject if `promise` does not settle within `ms` milliseconds. */
export async function withTimeout<T>(promise: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Appended to a tool error when the browser session was lost and cleared. */
export const SESSION_LOST_HINT =
  'The browser session was lost (window closed, browser crashed or session expired). ' +
  'It has been cleared; the next navigate_to call starts a fresh browser with the same settings.';
