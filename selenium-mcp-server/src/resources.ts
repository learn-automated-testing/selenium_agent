/**
 * MCP resources: the docs indexes (llms.txt) of Selenium and WebdriverIO, and the rules for AI assistants
 * per language, so a client can read them without web access.
 */
import { fetchDocs, DOCS_SOURCES } from './docs/framework-docs.js';
import { seleniumRulesFor, SELENIUM_RULES_SOURCE } from './tools/agents/selenium-rules.js';
import { SELENIUM_RULES_MARKDOWN } from './tools/agents/selenium-rules.data.js';

export interface ResourceInfo {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

/** Rules per language: the resource name and the framework it is generated for. */
const RULE_LANGUAGES: Record<string, { framework: string; label: string }> = {
  python: { framework: 'selenium-python-pytest', label: 'Python' },
  java: { framework: 'selenium-java-maven', label: 'Java' },
  javascript: { framework: 'selenium-js-mocha', label: 'JavaScript' },
  csharp: { framework: 'selenium-csharp-nunit', label: 'C#' },
  ruby: { framework: 'selenium-ruby', label: 'Ruby' },
  'robot-framework': { framework: 'robot-framework', label: 'Robot Framework (SeleniumLibrary)' },
  webdriverio: { framework: 'webdriverio-ts', label: 'WebdriverIO' },
};

export function listResources(): ResourceInfo[] {
  return [
    {
      uri: 'selenium://docs/llms.txt',
      name: 'Selenium docs index (llms.txt)',
      description: `Index of the current Selenium documentation for AI tools (${DOCS_SOURCES.selenium.llmsTxt}). ` +
        'Read a page with the get_selenium_docs tool.',
      mimeType: 'text/plain',
    },
    {
      uri: 'webdriverio://docs/llms.txt',
      name: 'WebdriverIO docs index (llms.txt)',
      description: `Index of the current WebdriverIO documentation (${DOCS_SOURCES.webdriverio.llmsTxt}).`,
      mimeType: 'text/plain',
    },
    {
      uri: 'selenium://rules/selenium.md',
      name: "Selenium's rules for AI assistants (all languages)",
      description: `Selenium's official rules for AI coding assistants, unchanged (${SELENIUM_RULES_SOURCE.url}, Apache-2.0).`,
      mimeType: 'text/markdown',
    },
    ...Object.entries(RULE_LANGUAGES).map(([key, { label }]) => ({
      uri: `selenium://rules/${key}`,
      name: `Rules for AI assistants: ${label}`,
      description: `The rules the generator and healer follow for ${label} tests, and check every test against.`,
      mimeType: 'text/markdown',
    })),
  ];
}

export async function readResource(uri: string): Promise<{ uri: string; mimeType: string; text: string }> {
  const docs = /^(selenium|webdriverio):\/\/docs\/llms\.txt$/.exec(uri);
  if (docs) {
    const source = docs[1] as 'selenium' | 'webdriverio';
    const url = DOCS_SOURCES[source].llmsTxt;
    try {
      const { text } = await fetchDocs(url);
      return { uri, mimeType: 'text/plain', text };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const fallback = source === 'selenium' ? SELENIUM_RULES_MARKDOWN : seleniumRulesFor('webdriverio-ts')!;
      return {
        uri, mimeType: 'text/markdown',
        text: `${url} could not be fetched (${reason}). The bundled rules for AI assistants instead:\n\n${fallback}`,
      };
    }
  }
  if (uri === 'selenium://rules/selenium.md') {
    return { uri, mimeType: 'text/markdown', text: SELENIUM_RULES_MARKDOWN };
  }
  const rules = /^selenium:\/\/rules\/([a-z-]+)$/.exec(uri);
  if (rules && RULE_LANGUAGES[rules[1]]) {
    return { uri, mimeType: 'text/markdown', text: seleniumRulesFor(RULE_LANGUAGES[rules[1]].framework)! };
  }
  throw new Error(`Unknown resource: ${uri}`);
}
