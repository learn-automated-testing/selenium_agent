import path from 'path';
import os from 'os';
import { existsSync } from 'fs';

let _cachedProjectRoot: string | null = null;

/**
 * Finds the project root by walking up from cwd looking for markers.
 * Looks for .git, package.json, or .claude directory.
 * Caches the result for the lifetime of the process.
 */
function findProjectRoot(): string {
  if (_cachedProjectRoot) return _cachedProjectRoot;

  const markers = ['.git', 'package.json', '.claude'];
  let dir = process.cwd();

  while (true) {
    if (markers.some(m => existsSync(path.join(dir, m)))) {
      _cachedProjectRoot = dir;
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  // Final fallback: cwd
  _cachedProjectRoot = process.cwd();
  return _cachedProjectRoot;
}

/**
 * Resolves the base output directory for all generated files.
 *
 * Priority:
 *   1. SELENIUM_MCP_OUTPUT_DIR env var (explicit override)
 *   2. Auto-detected project root (walks up from cwd looking for .git/package.json/.claude)
 *   3. process.cwd() (final fallback)
 *
 * This keeps the server generic: it writes output relative to the
 * caller's project, not relative to where the server is installed.
 */
export function getOutputDir(): string {
  const configured = process.env.SELENIUM_MCP_OUTPUT_DIR;
  if (configured) return expandHome(configured);
  const root = findProjectRoot();
  return isUsableProjectRoot(root) ? root : defaultOutputDir();
}

/** Where output goes when no project is found, e.g. when Claude Desktop starts the server in "/". */
export function defaultOutputDir(): string {
  return path.join(os.homedir(), 'selenium-ai-agent');
}

/**
 * The filesystem root or the home folder are never a project: Claude Desktop starts
 * MCP servers in "/", and ~ often holds a .claude folder that looks like a project marker.
 */
export function isUsableProjectRoot(dir: string): boolean {
  const resolved = path.resolve(dir);
  return resolved !== path.parse(resolved).root && resolved !== path.resolve(os.homedir());
}

/** Expand a leading ~ to the home folder (config files and env vars often use it). */
export function expandHome(p: string): string {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2));
  return p;
}

/** Directory for test plans: <output>/test-plans/ */
export function getTestPlansDir(): string {
  return path.join(getOutputDir(), 'test-plans');
}

/** Directory for generated tests: <output>/tests/ */
export function getTestsDir(): string {
  return path.join(getOutputDir(), 'tests');
}

/** Directory for test specs: <output>/specs/ */
export function getSpecsDir(): string {
  return path.join(getOutputDir(), 'specs');
}

/** Directory for risk profiles: <output>/risk-profiles/ */
export function getRiskProfilesDir(): string {
  return path.join(getOutputDir(), 'risk-profiles');
}

/** Directory for product discovery output: <output>/product-discovery/<slug>/ */
export function getProductDiscoveryDir(productSlug: string): string {
  return path.join(getOutputDir(), 'product-discovery', productSlug);
}

/**
 * Resolves the output directory for a tool.
 * If outputDir is provided (e.g. from a skill or explicit param), use it
 * (resolved relative to project root). Otherwise fall back to defaultDir.
 */
export function resolveOutputDir(outputDir: string | undefined, defaultDir: string): string {
  if (!outputDir) return defaultDir;
  const expanded = expandHome(outputDir);
  // Absolute paths are used as-is; relative paths resolve against the output folder
  return path.isAbsolute(expanded) ? expanded : path.join(getOutputDir(), expanded);
}
