import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { GeneratorSetupTool, GeneratorWriteTestTool } from './generator.js';
import { HealerFixTestTool } from './healer.js';

const ctx = (framework?: string) => ({
  generatorFramework: framework,
  clearRecording: () => undefined,
  startRecording: () => undefined,
  captureSnapshot: async () => undefined,
  ensureBrowser: async () => ({ get: async () => undefined }),
}) as never;

// The demo's "out of stock" test as the generator first wrote it, and as Selenium's rules want it.
const withSleep = [
  'import time', '', 'def test_out_of_stock(shop):', '    button = shop.find("add-to-cart-3")', '    button.click()',
  '    time.sleep(0.5)', '    assert "0 items" in shop.cart_text()', '',
].join('\n');
const withWait = [
  'from selenium.webdriver.support.ui import WebDriverWait', '', 'def test_out_of_stock(shop):',
  '    button = shop.find("add-to-cart-3")', '    button.click()',
  '    WebDriverWait(shop.driver, 2).until(lambda d: "0 items" in shop.cart_text())', '',
].join('\n');

describe("generator and healer follow Selenium's official rules", () => {
  let root: string;
  const env = process.env.SELENIUM_MCP_OUTPUT_DIR;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-')); process.env.SELENIUM_MCP_OUTPUT_DIR = root; });
  afterEach(() => { if (env === undefined) delete process.env.SELENIUM_MCP_OUTPUT_DIR; else process.env.SELENIUM_MCP_OUTPUT_DIR = env; });
  const base = () => ({ outputDir: path.join(root, 'tests'), projectRoot: root, verify: false });

  it('generator_setup_page hands the agent the rules for its language', async () => {
    const r = await new GeneratorSetupTool().execute(ctx(), { url: 'https://example.com', testPlan: 'plan' });
    expect(r.isError).to.not.equal(true);
    expect(r.content).to.include("Selenium's official rules for AI assistants (Python)");
    expect(r.content).to.include('## Explicit Waits');
    const java = await new GeneratorSetupTool().execute(ctx(), { url: 'https://example.com', testPlan: 'p', framework: 'selenium-java-maven' });
    expect(java.content).to.include('(Java)');
    const pw = await new GeneratorSetupTool().execute(ctx(), { url: 'https://example.com', testPlan: 'p', framework: 'playwright-js' });
    expect(pw.content).not.to.include('official rules for AI assistants');
  });

  it('generator_write_test refuses a test with a sleep and says which line', async () => {
    const r = await new GeneratorWriteTestTool().execute(ctx(), { ...base(), testCode: withSleep, filename: 'test_out_of_stock.py' });
    expect(r.isError).to.equal(true);
    expect(r.content).to.include('line 6 [no-sleep]');
    expect(fs.existsSync(path.join(root, 'tests', 'test_out_of_stock.py'))).to.equal(false);
  });

  it('generator_write_test writes the same test with an explicit wait', async () => {
    const r = await new GeneratorWriteTestTool().execute(ctx(), { ...base(), testCode: withWait, filename: 'test_out_of_stock.py' });
    expect(r.isError).to.not.equal(true);
    expect(JSON.parse(r.content).seleniumRules).to.equal("Follows Selenium's official rules for AI agents");
    expect(fs.readFileSync(path.join(root, 'tests', 'test_out_of_stock.py'), 'utf8')).to.equal(withWait);
  });

  it('writes anyway when the user explicitly allows it, and still reports the violation', async () => {
    const r = await new GeneratorWriteTestTool().execute(ctx(), {
      ...base(), testCode: withSleep, filename: 'test_out_of_stock.py', allowRuleViolations: true,
    });
    expect(r.isError).to.not.equal(true);
    expect(JSON.parse(r.content).seleniumRules).to.include('[no-sleep]');
  });

  it('reports warnings without blocking', async () => {
    const code = 'def test_x(driver):\n    driver.execute_script("arguments[0].click();", el)\n';
    const r = await new GeneratorWriteTestTool().execute(ctx(), { ...base(), testCode: code, filename: 'test_x.py' });
    expect(r.isError).to.not.equal(true);
    expect(JSON.parse(r.content).seleniumRules).to.include('warn  line 2 [no-js-click]');
  });

  it('healer_fix_test refuses a fix that adds a sleep, and keeps the file unchanged', async () => {
    const file = path.join(root, 'test_out_of_stock.py');
    fs.writeFileSync(file, withWait);
    const r = await new HealerFixTestTool().execute(ctx(), { testPath: file, fixedCode: withSleep, fixDescription: 'wait longer' });
    expect(r.isError).to.equal(true);
    expect(r.content).to.include('[no-sleep]');
    expect(fs.readFileSync(file, 'utf8')).to.equal(withWait);
    expect(fs.existsSync(file + '.bak')).to.equal(false);
  });
});
