import { describe, it, afterEach } from 'mocha';
import { expect } from 'chai';
import { getDocs, parseLlmsTxt, searchIndex, setDocsFetcher, DOCS_SOURCES } from './framework-docs.js';
import { GetSeleniumDocsTool } from '../tools/agents/docs.js';
import { listResources, readResource } from '../resources.js';

const SELENIUM_LLMS = [
  '# Selenium', '', '> Selenium automates browsers.', '',
  '## WebDriver',
  '- [Waiting Strategies](https://www.selenium.dev/documentation/webdriver/waits/): Explicit and implicit waits',
  '- [Select lists](https://www.selenium.dev/documentation/webdriver/support_features/select_lists/): Select elements',
  '- [BiDi](https://www.selenium.dev/documentation/webdriver/bidi/): Console logs and network over WebDriver BiDi',
].join('\n');

/** A fake web: remembers which URLs were fetched. */
function fakeWeb(pages: Record<string, string>) {
  const fetched: string[] = [];
  setDocsFetcher(async url => {
    fetched.push(url);
    if (url in pages) return pages[url];
    throw new Error(`HTTP 404 for ${url}`);
  });
  return fetched;
}

describe('framework docs (llms.txt)', () => {
  afterEach(() => setDocsFetcher(null));

  it('parses the links of an llms.txt index', () => {
    const links = parseLlmsTxt(SELENIUM_LLMS);
    expect(links).to.have.length(3);
    expect(links[0]).to.deep.equal({
      title: 'Waiting Strategies', url: 'https://www.selenium.dev/documentation/webdriver/waits/',
      description: 'Explicit and implicit waits',
    });
  });

  it('finds the best page for a topic', () => {
    const links = parseLlmsTxt(SELENIUM_LLMS);
    expect(searchIndex(links, 'explicit waits')[0].title).to.equal('Waiting Strategies');
    expect(searchIndex(links, 'console logs')[0].title).to.equal('BiDi');
    expect(searchIndex(links, 'zzz')).to.deep.equal([]);
  });

  it('returns the index when no page is asked for, and caches it', async () => {
    const fetched = fakeWeb({ 'https://www.selenium.dev/llms.txt': SELENIUM_LLMS });
    const first = await getDocs('selenium');
    const second = await getDocs('selenium');
    expect(first.text).to.equal(SELENIUM_LLMS);
    expect(second.cached).to.equal(true);
    expect(fetched).to.deep.equal(['https://www.selenium.dev/llms.txt']);
  });

  it('reads Selenium pages as <page>/index.md, from a URL or a path', async () => {
    const md = 'https://www.selenium.dev/documentation/webdriver/waits/index.md';
    fakeWeb({ [md]: '# Waiting Strategies' });
    expect((await getDocs('selenium', 'https://www.selenium.dev/documentation/webdriver/waits/')).url).to.equal(md);
    expect((await getDocs('selenium', 'documentation/webdriver/waits')).text).to.equal('# Waiting Strategies');
  });

  it('reads WebdriverIO pages as <page>.md, and picks the source from the URL', async () => {
    fakeWeb({ 'https://webdriver.io/docs/autowait.md': '# Auto-waiting' });
    const r = await getDocs('selenium', 'https://webdriver.io/docs/autowait');
    expect(r.source).to.equal('webdriverio');
    expect(r.text).to.equal('# Auto-waiting');
    expect((await getDocs('webdriverio', 'docs/autowait')).url).to.equal('https://webdriver.io/docs/autowait.md');
  });

  it('finds a page by topic through the index and lists the other matches', async () => {
    fakeWeb({
      'https://www.selenium.dev/llms.txt': SELENIUM_LLMS,
      'https://www.selenium.dev/documentation/webdriver/waits/index.md': '# Waiting Strategies',
    });
    const r = await getDocs('selenium', 'explicit waits');
    expect(r.url).to.equal('https://www.selenium.dev/documentation/webdriver/waits/index.md');
  });

  it('refuses other sites', async () => {
    fakeWeb({});
    try {
      await getDocs('selenium', 'https://example.com/docs');
      expect.fail('should have refused');
    } catch (err) {
      expect((err as Error).message).to.include('not example.com');
    }
  });

  describe('get_selenium_docs', () => {
    it('returns the page with its source', async () => {
      fakeWeb({ 'https://www.selenium.dev/documentation/webdriver/waits/index.md': '# Waiting Strategies\n\nUse WebDriverWait.' });
      const r = await new GetSeleniumDocsTool().execute({} as never, { page: 'documentation/webdriver/waits' });
      expect(r.isError).to.not.equal(true);
      expect(r.content).to.include('Source: https://www.selenium.dev/documentation/webdriver/waits/index.md');
      expect(r.content).to.include('Use WebDriverWait.');
    });

    it('falls back to the bundled rules when the site cannot be reached', async () => {
      fakeWeb({});
      const r = await new GetSeleniumDocsTool().execute({} as never, {});
      expect(r.isError).to.equal(true);
      expect(r.content).to.include("Selenium's bundled rules for AI assistants");
      expect(r.content).to.include('Never use `time.sleep()`');
    });

    it('cuts very long pages and says so', async () => {
      fakeWeb({ 'https://www.selenium.dev/llms.txt': 'x'.repeat(50000) });
      const r = await new GetSeleniumDocsTool().execute({} as never, {});
      expect(r.content).to.include('[Cut at 40000 characters of 50000.');
    });
  });

  describe('MCP resources', () => {
    it('lists the docs indexes and the rules per language', () => {
      const uris = listResources().map(r => r.uri);
      expect(uris).to.include.members([
        'selenium://docs/llms.txt', 'webdriverio://docs/llms.txt', 'selenium://rules/selenium.md',
        'selenium://rules/python', 'selenium://rules/java', 'selenium://rules/robot-framework', 'selenium://rules/webdriverio',
      ]);
    });

    it('reads llms.txt live, and the bundled rules when offline', async () => {
      fakeWeb({ [DOCS_SOURCES.selenium.llmsTxt]: SELENIUM_LLMS });
      expect((await readResource('selenium://docs/llms.txt')).text).to.equal(SELENIUM_LLMS);
      fakeWeb({});
      const offline = await readResource('selenium://docs/llms.txt');
      expect(offline.text).to.include('could not be fetched');
      expect(offline.text).to.include('# Selenium Rules for AI Assistants');
    });

    it('reads the rules for a language', async () => {
      expect((await readResource('selenium://rules/java')).text).to.include('(Java)');
      expect((await readResource('selenium://rules/robot-framework')).text).to.include('## Robot Framework (SeleniumLibrary)');
      expect((await readResource('selenium://rules/webdriverio')).text).to.include('# WebdriverIO rules');
      try { await readResource('selenium://rules/cobol'); expect.fail(); } catch (e) { expect((e as Error).message).to.include('Unknown resource'); }
    });
  });
});
