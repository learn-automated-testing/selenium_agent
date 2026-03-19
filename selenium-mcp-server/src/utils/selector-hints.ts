import { getOutputDir } from './paths.js';

export interface SelectorHint {
  css: string;
  tag: string;
  text?: string;
  ariaLabel?: string;
}

export interface SelectorHintsFile {
  [domain: string]: {
    [scopePattern: string]: SelectorHint[];
  };
}

function getHintsFilePath(): string {
  return getOutputDir() + '/selector-hints.json';
}

export async function loadHints(): Promise<SelectorHintsFile> {
  const fs = await import('node:fs/promises');
  try {
    const raw = await fs.readFile(getHintsFilePath(), 'utf-8');
    return JSON.parse(raw) as SelectorHintsFile;
  } catch {
    return {};
  }
}

export async function saveHints(hints: SelectorHintsFile): Promise<void> {
  const fs = await import('node:fs/promises');
  await fs.writeFile(getHintsFilePath(), JSON.stringify(hints, null, 2), 'utf-8');
}

/**
 * Get hints applicable to a specific domain + path.
 * Merges site-wide ("*") hints with path-matched hints.
 */
export function getHintsForPage(hints: SelectorHintsFile, domain: string, pathname: string): SelectorHint[] {
  const domainHints = hints[domain];
  if (!domainHints) return [];

  const result: SelectorHint[] = [];

  for (const [pattern, entries] of Object.entries(domainHints)) {
    if (pattern === '*') {
      result.push(...entries);
    } else {
      // Simple glob: "/blog/*" matches any path starting with "/blog/"
      const prefix = pattern.endsWith('/*') ? pattern.slice(0, -1) : pattern;
      if (pathname === pattern || pathname.startsWith(prefix)) {
        result.push(...entries);
      }
    }
  }

  return result;
}
