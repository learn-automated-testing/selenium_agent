import path from 'path';
import os from 'os';
import { existsSync, readdirSync } from 'fs';

let _cachedProjectRoot: string | null = null;

/** Files and folders that mark a project folder: version control, AI tool settings and the build files of the stacks we generate for. */
const PROJECT_MARKERS = [
  '.git', 'package.json', '.claude', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'pyproject.toml', 'requirements.txt',
  'setup.py', '.test-manifest.json',
];

function isProjectDir(dir: string): boolean {
  if (PROJECT_MARKERS.some(m => existsSync(path.join(dir, m)))) return true;
  try {
    return readdirSync(dir).some(f => f.endsWith('.csproj') || f.endsWith('.sln'));
  } catch {
    return false;
  }
}

/**
 * The project a folder belongs to: the nearest folder, from `start` upwards, with a project marker (.git, package.json,
 * .claude, pom.xml, build.gradle, *.csproj, *.sln, pyproject.toml, requirements.txt, ...). Null when there is none,
 * or when it would be the filesystem root or the home folder.
 */
export function detectProjectRoot(start = process.cwd()): string | null {
  let dir = path.resolve(start);
  while (true) {
    if (isProjectDir(dir)) return isUsableProjectRoot(dir) ? dir : null;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Finds the project root by walking up from cwd looking for markers.
 * Caches the result for the lifetime of the process.
 */
function findProjectRoot(): string {
  if (_cachedProjectRoot) return _cachedProjectRoot;
  _cachedProjectRoot = detectProjectRoot() ?? process.cwd();
  return _cachedProjectRoot;
}

/**
 * Resolves the base output directory for all generated files.
 *
 * Priority:
 *   1. SELENIUM_MCP_OUTPUT_DIR env var (explicit override)
 *   2. The project the server runs in: walks up from cwd to a project marker (.git, package.json, pom.xml, *.csproj, ...)
 *   3. ~/selenium-ai-agent, when it runs outside any project (Claude Desktop starts servers in "/")
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
  return specsDirFor(getOutputDir());
}

/**
 * The plans folder for an output (project) folder: specs/ by default, as in Playwright's planner.
 * SELENIUM_MCP_SPECS_DIR (or --specs-dir) picks another one, e.g. "test-plans" when the project already has a
 * specs/ folder for something else; a relative path is taken from the output folder.
 */
export function specsDirFor(outputDir: string): string {
  const configured = process.env.SELENIUM_MCP_SPECS_DIR?.trim();
  if (!configured) return path.join(outputDir, 'specs');
  const dir = expandHome(configured);
  return path.isAbsolute(dir) ? dir : path.join(outputDir, dir);
}

/**
 * The agent's own folder for generated files the user does not edit (the read-only review pages):
 * <output>/.selenium-ai-agent/. It never writes HTML into the user's own folders.
 */
export function getAgentFilesDir(): string {
  return path.join(getOutputDir(), '.selenium-ai-agent');
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
