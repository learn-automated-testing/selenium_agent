/**
 * Current framework documentation for the AI assistant: the llms.txt indexes of Selenium and WebdriverIO and
 * the Markdown versions of their pages. Not every MCP client lets the model fetch web pages, so the server does.
 *
 * - Selenium: https://www.selenium.dev/llms.txt; every page has a Markdown version at <page>/index.md
 * - WebdriverIO: https://webdriver.io/llms.txt; every page has a Markdown version at <page>.md
 *
 * Only these two sites are fetched. Results are cached in memory for a day; when a site can't be reached,
 * the bundled Selenium rules are the fallback.
 */
export type DocsSource = 'selenium' | 'webdriverio';

interface SourceInfo {
  name: string;
  hosts: string[];
  base: string;
  llmsTxt: string;
  /** The Markdown URL of a docs page. */
  markdownUrl: (pageUrl: URL) => string;
}

export const DOCS_SOURCES: Record<DocsSource, SourceInfo> = {
  selenium: {
    name: 'Selenium',
    hosts: ['www.selenium.dev', 'selenium.dev'],
    base: 'https://www.selenium.dev',
    llmsTxt: 'https://www.selenium.dev/llms.txt',
    markdownUrl: u => {
      if (u.pathname.endsWith('.md') || u.pathname.endsWith('.txt')) return u.origin + u.pathname;
      const p = u.pathname.endsWith('/') ? u.pathname : u.pathname + '/';
      return `https://www.selenium.dev${p}index.md`;
    },
  },
  webdriverio: {
    name: 'WebdriverIO',
    hosts: ['webdriver.io'],
    base: 'https://webdriver.io',
    llmsTxt: 'https://webdriver.io/llms.txt',
    markdownUrl: u => {
      if (u.pathname.endsWith('.md') || u.pathname.endsWith('.txt')) return u.origin + u.pathname;
      return `https://webdriver.io${u.pathname.replace(/\/+$/, '')}.md`;
    },
  },
};

const DAY_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { text: string; at: number }>();

export type Fetcher = (url: string) => Promise<string>;

const defaultFetcher: Fetcher = async url => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'text/markdown, text/plain' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
};

let fetcher: Fetcher = defaultFetcher;

/** For tests: replace the network fetch. */
export function setDocsFetcher(f: Fetcher | null): void {
  fetcher = f ?? defaultFetcher;
  cache.clear();
}

/** Fetch a docs URL, from the cache when it is less than a day old. */
export async function fetchDocs(url: string): Promise<{ text: string; cached: boolean }> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < DAY_MS) return { text: hit.text, cached: true };
  const text = await fetcher(url);
  cache.set(url, { text, at: Date.now() });
  return { text, cached: false };
}

/** Which source a URL belongs to, or null for any other site. */
export function sourceOfUrl(url: URL): DocsSource | null {
  for (const [key, info] of Object.entries(DOCS_SOURCES) as [DocsSource, SourceInfo][]) {
    if (info.hosts.includes(url.hostname)) return key;
  }
  return null;
}

export interface IndexLink { title: string; url: string; description: string }

/** The links in an llms.txt index: "- [Title](url): description". */
export function parseLlmsTxt(text: string): IndexLink[] {
  const links: IndexLink[] = [];
  const re = /^\s*[-*]\s*\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)\s*:?\s*(.*)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) links.push({ title: m[1].trim(), url: m[2], description: m[3].trim() });
  return links;
}

/** Best matches for a topic among the index links (title counts most, then URL, then description). */
export function searchIndex(links: IndexLink[], topic: string, max = 5): IndexLink[] {
  const words = topic.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1);
  if (words.length === 0) return [];
  const scored = links.map(link => {
    const title = link.title.toLowerCase();
    const url = link.url.toLowerCase();
    const desc = link.description.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (title.includes(w)) score += 3;
      if (url.includes(w)) score += 2;
      if (desc.includes(w)) score += 1;
    }
    if (title === topic.toLowerCase()) score += 5;
    return { link, score };
  });
  return scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, max).map(s => s.link);
}

export interface DocsResult {
  source: DocsSource;
  url: string;
  text: string;
  cached: boolean;
  /** Other pages that matched the topic, when the page was found by searching. */
  alternatives?: IndexLink[];
}

/**
 * Resolve a page, URL or topic to Markdown documentation.
 * - nothing: the llms.txt index
 * - a URL on selenium.dev / webdriver.io, or a path such as "documentation/webdriver/waits": that page
 * - a topic such as "explicit waits": the best match in the llms.txt index
 */
export async function getDocs(source: DocsSource, page?: string): Promise<DocsResult> {
  const info = DOCS_SOURCES[source];
  const query = (page ?? '').trim();
  if (!query || /^llms(\.txt)?$/i.test(query)) {
    const r = await fetchDocs(info.llmsTxt);
    return { source, url: info.llmsTxt, ...r };
  }

  let url: URL | null = null;
  if (/^https?:\/\//i.test(query)) {
    url = new URL(query);
    const owner = sourceOfUrl(url);
    if (!owner) throw new Error(`Only ${Object.values(DOCS_SOURCES).flatMap(s => s.hosts).join(', ')} are fetched, not ${url.hostname}.`);
    source = owner;
  } else if (/^\/?[a-z0-9_\-]+(\/[a-z0-9_\-.]+)+\/?$/i.test(query) || /^\/?(documentation|docs)\b/i.test(query)) {
    url = new URL(query.startsWith('/') ? query : '/' + query, info.base);
  }

  if (url) {
    const md = DOCS_SOURCES[source].markdownUrl(url);
    const r = await fetchDocs(md);
    return { source, url: md, ...r };
  }

  // A topic: search the index and fetch the best match.
  const index = await fetchDocs(info.llmsTxt);
  const matches = searchIndex(parseLlmsTxt(index.text), query);
  if (matches.length === 0) {
    throw new Error(`No ${info.name} docs page matches "${query}". Call without a page for the full index (${info.llmsTxt}).`);
  }
  const best = new URL(matches[0].url);
  const md = info.markdownUrl(best);
  const r = await fetchDocs(md);
  return { source, url: md, ...r, alternatives: matches.slice(1) };
}
