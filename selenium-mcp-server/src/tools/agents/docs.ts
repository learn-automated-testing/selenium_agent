import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { getDocs, DOCS_SOURCES, type DocsSource } from '../../docs/framework-docs.js';
import { seleniumRulesFor, SELENIUM_RULES_SOURCE } from './selenium-rules.js';

const MAX_CHARS = 40000;

const schema = z.object({
  page: z.string().optional().describe(
    'What to read: empty for the docs index (llms.txt); a docs URL or path such as "documentation/webdriver/waits"; ' +
    'or a topic such as "explicit waits", "select lists", "BiDi console logs"'),
  framework: z.enum(['selenium', 'webdriverio']).optional()
    .describe('Whose docs: selenium (default) or webdriverio. A URL picks it automatically.'),
});

export class GetSeleniumDocsTool extends BaseTool {
  readonly name = 'get_selenium_docs';
  readonly description = `Read the current Selenium (or WebdriverIO) documentation as Markdown, from the projects' own llms.txt indexes.

Use it before writing or fixing code with an API you are not sure of: an API that is not in the current docs or API
reference does not exist (Selenium's guidance for AI agents). Without "page" it returns the docs index
(https://www.selenium.dev/llms.txt); with a URL, path or topic it returns that page, with the code examples for every
language. Only selenium.dev and webdriver.io are fetched; pages are cached for a day.`;
  readonly inputSchema = schema;
  // No page snapshot after reading docs: it doesn't touch the browser.
  readonly category: ToolCategory = 'generator';

  async execute(_context: Context, params: unknown): Promise<ToolResult> {
    const { page, framework } = this.parseParams(schema, params);
    const source: DocsSource = framework ?? 'selenium';
    try {
      const r = await getDocs(source, page);
      let text = r.text;
      let note = '';
      if (text.length > MAX_CHARS) {
        text = text.slice(0, MAX_CHARS);
        note = `\n\n[Cut at ${MAX_CHARS} characters of ${r.text.length}. Ask for a more specific page.]`;
      }
      const head = [`Source: ${r.url}${r.cached ? ' (cached)' : ''}`];
      if (r.alternatives?.length) {
        head.push('Other matching pages: ' + r.alternatives.map(a => `${a.title} (${a.url})`).join('; '));
      }
      return this.success(head.join('\n') + '\n\n' + text + note, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Offline or blocked: the bundled rules still answer the most common questions.
      const fallback = source === 'selenium'
        ? `\n\nThe docs could not be fetched, so here are Selenium's bundled rules for AI assistants ` +
          `(${SELENIUM_RULES_SOURCE.url}):\n\n${seleniumRulesFor('selenium-python-pytest')}`
        : `\n\nThe docs could not be fetched. Index: ${DOCS_SOURCES.webdriverio.llmsTxt}\n\n${seleniumRulesFor('webdriverio-ts')}`;
      return this.error(`Could not read the ${DOCS_SOURCES[source].name} docs: ${message}${fallback}`);
    }
  }
}
