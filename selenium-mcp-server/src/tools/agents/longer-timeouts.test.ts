import { expect } from 'chai';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkSeleniumRules, findLongerTimeouts, timeoutsOnLine } from './selenium-rules.js';
import { HealerFixTestTool } from './healer.js';

const ctx = () => ({
  generatorFramework: undefined,
  clearRecording: () => undefined,
  startRecording: () => undefined,
  captureSnapshot: async () => undefined,
  ensureBrowser: async () => ({ get: async () => undefined }),
}) as never;

const rules = (oldCode: string, newCode: string, framework: string, file: string) =>
  findLongerTimeouts(oldCode, newCode, framework, file).map(v => `${v.line}:${v.rule}`);

describe('a longer timeout is not a fix', () => {
  describe('timeoutsOnLine reads wait timeouts in seconds', () => {
    it('Java, C#, Python, JavaScript, WebdriverIO and Robot Framework', () => {
      expect(timeoutsOnLine('new WebDriverWait(driver, Duration.ofSeconds(10));', 'Java')).to.deep.equal([10]);
      expect(timeoutsOnLine('new WebDriverWait(driver, Duration.ofMillis(500));', 'Java')).to.deep.equal([0.5]);
      expect(timeoutsOnLine('new WebDriverWait(driver, TimeSpan.FromSeconds(10));', '.NET')).to.deep.equal([10]);
      expect(timeoutsOnLine('WebDriverWait(driver, 10).until(cond)', 'Python')).to.deep.equal([10]);
      expect(timeoutsOnLine('WebDriverWait(driver, timeout=2.5)', 'Python')).to.deep.equal([2.5, 2.5]);
      expect(timeoutsOnLine('await driver.wait(until.elementLocated(By.id("x")), 5000);', 'JavaScript')).to.deep.equal([5]);
      expect(timeoutsOnLine("await $('#x').waitForDisplayed({ timeout: 8000 })", 'WebdriverIO')).to.deep.equal([8]);
      expect(timeoutsOnLine('    Wait Until Element Is Visible    id:flash    timeout=10s', 'Python', true)).to.deep.equal([10]);
      expect(timeoutsOnLine('    Set Selenium Timeout    1 min', 'Python', true)).to.deep.equal([60]);
    });
  });

  describe('findLongerTimeouts', () => {
    it('flags a wait raised above the old maximum', () => {
      const before = 'wait = new WebDriverWait(driver, Duration.ofSeconds(10));';
      expect(rules(before, 'wait = new WebDriverWait(driver, Duration.ofSeconds(30));', 'selenium-java-maven', 'LoginTest.java'))
        .to.deep.equal(['1:no-longer-timeout']);
      expect(rules('var w = new WebDriverWait(driver, TimeSpan.FromSeconds(10));', 'var w = new WebDriverWait(driver, TimeSpan.FromSeconds(60));',
        'selenium-csharp-nunit', 'LoginTests.cs')).to.deep.equal(['1:no-longer-timeout']);
      expect(rules('WebDriverWait(driver, 5)', 'WebDriverWait(driver, 15)', 'selenium-python-pytest', 'test_login.py'))
        .to.deep.equal(['1:no-longer-timeout']);
      expect(rules("await $('#x').waitForDisplayed({ timeout: 5000 })", "await $('#x').waitForDisplayed({ timeout: 20000 })",
        'webdriverio-ts', 'login.e2e.ts')).to.deep.equal(['1:no-longer-timeout']);
      expect(rules('    Wait Until Element Is Visible    id:flash    timeout=5s', '    Wait Until Element Is Visible    id:flash    timeout=20s',
        'robot-framework', 'login.robot')).to.deep.equal(['1:no-longer-timeout']);
    });

    it('allows the same timeout, a shorter one, and new waits in a test that had none', () => {
      const java = 'wait = new WebDriverWait(driver, Duration.ofSeconds(10));';
      expect(rules(java, java + '\nother = new WebDriverWait(driver, Duration.ofSeconds(10));', 'selenium-java-maven', 'A.java')).to.deep.equal([]);
      expect(rules(java, 'wait = new WebDriverWait(driver, Duration.ofSeconds(5));', 'selenium-java-maven', 'A.java')).to.deep.equal([]);
      expect(rules('driver.findElement(By.id("x")).click();', java, 'selenium-java-maven', 'A.java')).to.deep.equal([]);
      expect(rules('', java, 'selenium-java-maven', 'A.java')).to.deep.equal([]);
    });

    it('ignores comments and files that are not Selenium tests', () => {
      expect(rules('WebDriverWait(driver, 5)', '# WebDriverWait(driver, 50)', 'selenium-python-pytest', 'test_x.py')).to.deep.equal([]);
      expect(rules('x', 'y', 'playwright-js', 'a.spec.js')).to.deep.equal([]);
    });
  });

  describe('healer_fix_test', () => {
    let dir: string;
    const env = process.env.SELENIUM_MCP_OUTPUT_DIR;
    beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'timeout-')); process.env.SELENIUM_MCP_OUTPUT_DIR = dir; });
    afterEach(() => { if (env === undefined) delete process.env.SELENIUM_MCP_OUTPUT_DIR; else process.env.SELENIUM_MCP_OUTPUT_DIR = env; });

    const original = [
      'from selenium.webdriver.support.ui import WebDriverWait', '',
      'def test_login(driver):', '    WebDriverWait(driver, 5).until(lambda d: d.find_element("id", "flash").is_displayed())', '',
    ].join('\n');

    it('refuses a fix that only raises the timeout, and leaves the file alone', async () => {
      const file = path.join(dir, 'test_login.py');
      fs.writeFileSync(file, original);
      const r = await new HealerFixTestTool().execute(ctx(), {
        testPath: file, fixedCode: original.replace('WebDriverWait(driver, 5)', 'WebDriverWait(driver, 30)'), fixDescription: 'more time',
      });
      expect(r.isError).to.equal(true);
      expect(String(r.content)).to.include('[no-longer-timeout]');
      expect(String(r.content)).to.include('from 5s to 30s');
      expect(fs.readFileSync(file, 'utf8')).to.equal(original);
    });

    it('writes it when the user explicitly allows it', async () => {
      const file = path.join(dir, 'test_login.py');
      fs.writeFileSync(file, original);
      const fixed = original.replace('WebDriverWait(driver, 5)', 'WebDriverWait(driver, 30)');
      const r = await new HealerFixTestTool().execute(ctx(), { testPath: file, fixedCode: fixed, fixDescription: 'slow CI', allowRuleViolations: true });
      expect(r.isError).to.not.equal(true);
      expect(fs.readFileSync(file, 'utf8')).to.equal(fixed);
    });
  });
});

describe('C#: Selenium 3 APIs that Selenium 4 .NET removed', () => {
  const ids = (code: string) => checkSeleniumRules(code, 'selenium-csharp-nunit', 'Tests.cs').map(v => `${v.severity}:${v.rule}`);

  it('flags the int WebDriverWait, ImplicitlyWait() and ExpectedConditions', () => {
    expect(ids('var wait = new WebDriverWait(driver, 10);')).to.deep.equal(['error:csharp-selenium3-api']);
    expect(ids('driver.Manage().Timeouts().ImplicitlyWait(TimeSpan.FromSeconds(10));')).to.deep.equal(['error:csharp-selenium3-api']);
    expect(ids('wait.Until(ExpectedConditions.ElementToBeClickable(By.Id("x")));')).to.deep.equal(['error:csharp-selenium3-api']);
    expect(ids('options.AddArgument("--headless");')).to.deep.equal(['error:old-headless']);
    expect(ids('options.AddArgument("headless");')).to.deep.equal(['error:old-headless']);
  });

  it('accepts Selenium 4 C#', () => {
    expect(ids('var wait = new WebDriverWait(driver, TimeSpan.FromSeconds(10));')).to.deep.equal([]);
    expect(ids('wait.Until(d => d.FindElement(By.Id("flash")).Displayed);')).to.deep.equal([]);
    expect(ids('options.AddArgument("--headless=new");')).to.deep.equal([]);
  });

  it('leaves Java ExpectedConditions alone', () => {
    expect(checkSeleniumRules('wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("x")));', 'selenium-java-maven', 'A.java'))
      .to.deep.equal([]);
  });
});
