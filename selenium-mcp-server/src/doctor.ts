import net from 'node:net';
import { accessSync, constants, existsSync } from 'node:fs';
import path from 'node:path';
import { getOutputDir } from './utils/paths.js';
import {
  detectChromeVersion,
  findCachedDriver,
  findChromedriverOnPath,
  getSeleniumCacheDir,
  inspectSeleniumManager,
  type ChromeInfo,
} from './driver-provision.js';
import { cftPlatform, buildChromedriverUrl } from './driver-download.js';
import { loadProxyConfig } from './proxy-config.js';

/** Outcome of inspecting the bundled Selenium Manager binary. */
export interface ManagerInfo {
  readonly path: string | null;
  readonly exists: boolean;
  readonly executable: boolean;
}

/** Result of a single doctor check. */
export interface DoctorCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
  /** Concrete, copy-pasteable next step when the check fails. */
  readonly fix?: string;
}

export interface DoctorReport {
  readonly checks: readonly DoctorCheck[];
  readonly ok: boolean;
}

/** Dependencies of runDoctor, injectable for testing. */
export interface DoctorDeps {
  detectChrome: () => ChromeInfo | null;
  findCached: (major: number) => string | null;
  findOnPath: () => string | null;
  override: string | null;
  inspectManager: () => ManagerInfo;
  probe: (host: string, port: number, timeoutMs: number) => Promise<boolean>;
  proxy?: string;
  cacheDir: string;
  outputDir: string;
}

/** Raw TCP reachability probe — dependency-free, honours no proxy itself. */
export function tcpProbe(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const finish = (ok: boolean): void => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

function checkChrome(chrome: ChromeInfo | null): DoctorCheck {
  if (!chrome) {
    return {
      name: 'Chrome installed',
      ok: false,
      detail: 'Google Chrome could not be detected',
      fix: 'Install Google Chrome, or ensure it is on PATH (Linux) / in the standard location.',
    };
  }
  return {
    name: 'Chrome installed',
    ok: true,
    detail: `Chrome ${chrome.version} (major ${chrome.major})`,
  };
}

/**
 * Show how the driver WOULD be provisioned (no download): the chosen strategy,
 * the resolved/cached path, and — for the direct path — the exact storage URL.
 * Informational: "not cached yet" is fine because the direct path downloads it.
 */
function checkProvisionPlan(
  chrome: ChromeInfo | null,
  override: string | null,
  onPath: string | null,
  cached: string | null,
): DoctorCheck {
  let strategy: string;
  let driver: string;
  let url: string | null = null;

  if (override) {
    strategy = 'override';
    driver = override;
  } else if (onPath) {
    strategy = 'path';
    driver = onPath;
  } else if (cached) {
    strategy = 'cache';
    driver = cached;
  } else if (chrome) {
    const cftPlat = cftPlatform();
    if (cftPlat) {
      strategy = 'direct';
      url = buildChromedriverUrl(chrome.version, cftPlat);
      driver = '(will be downloaded to the cache)';
    } else {
      strategy = 'fallback';
      driver = '(resolved by Selenium Manager)';
    }
  } else {
    strategy = 'fallback';
    driver = '(resolved by Selenium Manager)';
  }

  const detail = [`strategy: ${strategy}`, `driver: ${driver}`, url ? `url: ${url}` : null]
    .filter(Boolean)
    .join('\n     ');

  return { name: 'Driver provisioning plan', ok: true, detail };
}

async function checkProxy(
  proxy: string,
  probe: (host: string, port: number, timeoutMs: number) => Promise<boolean>,
): Promise<DoctorCheck> {
  let host: string;
  let port: number;
  try {
    const url = new URL(proxy);
    host = url.hostname;
    port = url.port ? parseInt(url.port, 10) : url.protocol === 'https:' ? 443 : 80;
  } catch {
    return {
      name: 'Proxy reachable',
      ok: false,
      detail: `configured proxy is not a valid URL: ${proxy}`,
      fix: 'Fix the proxy URL in ~/.selenium-ai-agent/config.json or the HTTPS_PROXY env var.',
    };
  }
  const ok = await probe(host, port, 5_000);
  return ok
    ? { name: 'Proxy reachable', ok: true, detail: `proxy ${host}:${port} reachable` }
    : {
        name: 'Proxy reachable',
        ok: false,
        detail: `proxy ${host}:${port} is NOT reachable`,
        fix: 'Check the proxy host/port and that the VPN is connected.',
      };
}

/**
 * Per-host reachability. The storage host is required (the direct download path);
 * the metadata host is only used by the Selenium Manager fallback, so its being
 * unreachable is reported but never fails the report.
 */
async function checkHosts(
  proxy: string | undefined,
  probe: (host: string, port: number, timeoutMs: number) => Promise<boolean>,
): Promise<DoctorCheck[]> {
  if (proxy) {
    return [await checkProxy(proxy, probe)];
  }

  const [storageOk, metadataOk] = await Promise.all([
    probe('storage.googleapis.com', 443, 5_000),
    probe('googlechromelabs.github.io', 443, 5_000),
  ]);

  return [
    {
      name: 'Storage host (driver download)',
      ok: storageOk,
      detail: storageOk
        ? 'storage.googleapis.com reachable'
        : 'storage.googleapis.com is NOT reachable',
      fix: storageOk
        ? undefined
        : 'Behind a proxy? Set "proxy" in ~/.selenium-ai-agent/config.json or HTTPS_PROXY. '
          + 'Air-gapped? Set SE_CHROMEDRIVER to a local driver or SE_CHROMEDRIVER_MIRROR to a mirror.',
    },
    {
      name: 'Metadata host (fallback only)',
      ok: true, // never gates — the direct path does not need it
      detail: metadataOk
        ? 'googlechromelabs.github.io reachable'
        : 'googlechromelabs.github.io NOT reachable — fine; only the Selenium Manager fallback uses it',
    },
  ];
}

function checkManager(info: ManagerInfo): DoctorCheck {
  if (info.exists && info.executable) {
    return { name: 'Selenium Manager binary', ok: true, detail: `executable: ${info.path}` };
  }
  const detail = !info.path
    ? 'selenium-webdriver could not be resolved'
    : info.exists
      ? `present but not executable: ${info.path}`
      : `not found: ${info.path}`;
  return {
    name: 'Selenium Manager binary',
    ok: false,
    detail,
    fix: 'selenium-webdriver is missing or incompletely installed — reinstall it '
      + '(npm install selenium-webdriver). Under npx, clear the npx cache and retry.',
  };
}

function checkCache(cacheDir: string): DoctorCheck {
  const present = existsSync(cacheDir);
  return {
    name: 'Driver cache location',
    ok: true,
    detail: present ? `${cacheDir} (exists)` : `${cacheDir} (will be created on first run)`,
  };
}

function defaultDeps(): DoctorDeps {
  return {
    detectChrome: detectChromeVersion,
    findCached: (major) => findCachedDriver(major),
    findOnPath: findChromedriverOnPath,
    override: process.env.SE_CHROMEDRIVER?.trim() || null,
    inspectManager: inspectSeleniumManager,
    probe: tcpProbe,
    proxy: loadProxyConfig().proxy,
    cacheDir: getSeleniumCacheDir(),
    outputDir: getOutputDir(),
  };
}

/**
 * Run all preflight diagnostics. Each check carries a concrete fix on failure.
 * Never throws — a failed probe becomes a failed check.
 */
export async function runDoctor(deps: Partial<DoctorDeps> = {}): Promise<DoctorReport> {
  const d: DoctorDeps = { ...defaultDeps(), ...deps };

  const chrome = d.detectChrome();
  const cached = chrome ? d.findCached(chrome.major) : null;
  const onPath = d.findOnPath();

  const checks: DoctorCheck[] = [
    checkManager(d.inspectManager()),
    checkChrome(chrome),
    checkProvisionPlan(chrome, d.override, onPath, cached),
    ...(await checkHosts(d.proxy, d.probe)),
    checkCache(d.cacheDir),
    checkOutputDir(d.outputDir),
  ];

  return { checks, ok: checks.every((c) => c.ok) };
}

/** Where generated files go, and whether that folder can be written. */
export function checkOutputDir(dir: string): DoctorCheck {
  const writable = canWriteTo(dir);
  return {
    name: 'Output folder',
    ok: writable,
    detail: `${dir}${process.env.SELENIUM_MCP_OUTPUT_DIR ? ' (SELENIUM_MCP_OUTPUT_DIR)' : ''}`,
    fix: 'Set SELENIUM_MCP_OUTPUT_DIR to a folder you can write to, e.g. ~/selenium-ai-agent',
  };
}

function canWriteTo(dir: string): boolean {
  let probe = path.resolve(dir);
  // The folder may not exist yet: check the nearest existing parent.
  while (!existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) return false;
    probe = parent;
  }
  try {
    accessSync(probe, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** Render a report as a human-readable, 80-column-friendly block. */
export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = ['Selenium AI Agent — doctor', ''];
  for (const check of report.checks) {
    lines.push(`${check.ok ? '[OK]' : '[X] '} ${check.name}`);
    lines.push(`     ${check.detail}`);
    if (!check.ok && check.fix) {
      lines.push(`     fix: ${check.fix}`);
    }
  }
  lines.push('');
  lines.push(report.ok ? 'All checks passed.' : 'Some checks failed — see the fixes above.');
  return lines.join('\n');
}
