/**
 * Shared manifest types used by both generator and healer tools.
 * The test manifest bridges generator → healer: records everything
 * the healer needs to run tests without rediscovering the project.
 */

export interface RunCommand {
  command: string;
  args: string[];
}

export interface TestManifestEntry {
  file: string;
  framework: string;
  createdAt: string;
  specFile?: string;
}

export interface SeedTestEntry {
  file: string;
  framework: string;
  description: string;
  createdAt: string;
}

export interface TestManifest {
  version: 1;
  projectRoot: string;
  baseUrl: string;
  framework: string;
  runCommand: RunCommand | null;
  configFile: string | null;
  tests: TestManifestEntry[];
  seedTests?: SeedTestEntry[];
  updatedAt: string;
}

export interface SpecEntry {
  specFile: string;
  title: string;
  testFiles: string[];
  createdAt: string;
}

export interface SelectorValidationResult {
  selector: string;
  framework: string;
  valid: boolean;
  matchCount: number;
  suggestion?: string;
}

export const MANIFEST_FILENAME = '.test-manifest.json';

export async function readManifest(dir: string): Promise<TestManifest | null> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const manifestPath = path.join(dir, MANIFEST_FILENAME);
  try {
    const content = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(content) as TestManifest;
  } catch {
    return null;
  }
}

export async function writeManifest(dir: string, manifest: TestManifest): Promise<string> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const manifestPath = path.join(dir, MANIFEST_FILENAME);
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return manifestPath;
}

export async function findManifest(startPath: string): Promise<TestManifest | null> {
  const fs = await import('fs/promises');
  const path = await import('path');

  let dir = path.dirname(path.resolve(startPath));
  const root = '/';
  while (dir !== root) {
    try {
      const content = await fs.readFile(path.join(dir, MANIFEST_FILENAME), 'utf-8');
      return JSON.parse(content) as TestManifest;
    } catch { /* not found, keep walking */ }
    dir = path.dirname(dir);
  }
  return null;
}
