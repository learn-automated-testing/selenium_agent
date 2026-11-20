import { expect } from 'chai';
import {
  seleniumLanguage, seleniumRulesFor, checkSeleniumRules, formatRuleViolations, SELENIUM_RULES_SOURCE,
} from './selenium-rules.js';

const rules = (code: string, framework = 'selenium-python-pytest', file = 'test_x.py') =>
  checkSeleniumRules(code, framework, file);
const ids = (code: string, framework?: string, file?: string) => rules(code, framework, file).map(v => `${v.severity}:${v.rule}`);

describe('Selenium official rules', () => {
  describe('seleniumLanguage', () => {
    it('maps frameworks to Selenium bindings', () => {
      expect(seleniumLanguage('selenium-python-pytest')).to.equal('Python');
      expect(seleniumLanguage('robot-framework')).to.equal('Python');
      expect(seleniumLanguage('selenium-java-maven')).to.equal('Java');
      expect(seleniumLanguage('selenium-csharp-nunit')).to.equal('.NET');
      expect(seleniumLanguage('selenium-js-mocha')).to.equal('JavaScript');
    });
    it('returns null for frameworks that do not use Selenium WebDriver', () => {
      expect(seleniumLanguage('playwright-js')).to.equal(null);
      expect(seleniumLanguage('webdriverio-ts')).to.equal(null);
    });
    it('falls back to the file extension for frameworks it does not know', () => {
      expect(seleniumLanguage('my-own-setup', 'LoginTest.java')).to.equal('Java');
      expect(seleniumLanguage('', 'login_spec.rb')).to.equal('Ruby');
    });
  });

  describe('seleniumRulesFor', () => {
    it('gives the core principles and only the chosen language\'s examples, with the source', () => {
      const md = seleniumRulesFor('selenium-python-pytest')!;
      expect(md).to.include('Never use `time.sleep()`');
      expect(md).to.include('## Explicit Waits');
      expect(md).to.include('WebDriverWait');
      expect(md).to.include(SELENIUM_RULES_SOURCE.url);
      expect(md).to.include('https://www.selenium.dev/documentation/ai_agents/');
      expect(md).not.to.include('### Java');
      expect(md).not.to.match(/new ChromeDriver\(\)/);
    });
    it('gives Java examples for Java', () => {
      const md = seleniumRulesFor('selenium-java-maven')!;
      expect(md).to.include('new ChromeDriver()');
      expect(md).not.to.include('webdriver.Chrome()');
    });
    it('returns null for Playwright', () => {
      expect(seleniumRulesFor('playwright-js')).to.equal(null);
    });
    it("gives WebdriverIO its own rules, from WebdriverIO's docs", () => {
      const md = seleniumRulesFor('webdriverio-ts')!;
      expect(md).to.include('# WebdriverIO rules for AI assistants');
      expect(md).to.include('https://webdriver.io/docs/bestpractices');
      expect(md).to.include('waitForDisplayed');
      expect(md).to.include("not Selenium's");
      expect(md).not.to.include('selenium.dev');
    });
  });

  describe('checkSeleniumRules', () => {
    it('accepts modern Selenium code', () => {
      const code = [
        'from selenium.webdriver.support.ui import WebDriverWait',
        'from selenium.webdriver.support import expected_conditions as EC',
        'def test_cart(driver):',
        '    # never time.sleep(1) here: a comment does not count',
        '    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.CSS_SELECTOR, "[data-testid=\'add\']"))).click()',
        '    options.add_argument("--headless=new")',
      ].join('\n');
      expect(rules(code)).to.deep.equal([]);
    });

    it('rejects the time.sleep the demo tests used', () => {
      const v = rules('def test_out_of_stock(shop):\n    button.click()\n    time.sleep(0.5)\n');
      expect(v).to.have.length(1);
      expect(v[0]).to.include({ rule: 'no-sleep', severity: 'error', line: 3 });
    });

    it('rejects sleeps in every binding', () => {
      expect(ids('Thread.sleep(2000);', 'selenium-java-maven', 'A.java')).to.include('error:no-sleep');
      expect(ids('Thread.Sleep(2000);', 'selenium-csharp-nunit', 'A.cs')).to.include('error:no-sleep');
      expect(ids('await driver.sleep(1000);', 'selenium-js-mocha', 'a.test.js')).to.include('error:no-sleep');
      expect(ids('await new Promise(r => setTimeout(r, 500));', 'selenium-js-mocha', 'a.test.js')).to.include('error:no-sleep');
      expect(ids('  sleep 2', 'selenium-ruby-rspec', 'a_spec.rb')).to.include('error:no-sleep');
      expect(ids('    Sleep    2s', 'robot-framework', 'cart.robot')).to.include('error:no-sleep');
    });

    it('rejects driver managers and hard-coded driver paths', () => {
      expect(ids('from webdriver_manager.chrome import ChromeDriverManager')).to.include('error:no-driver-manager');
      expect(ids('driver = webdriver.Chrome(executable_path="/usr/bin/chromedriver")')).to.include('error:no-driver-path');
      expect(ids('service = Service("/usr/local/bin/chromedriver")')).to.include('error:no-driver-path');
      expect(ids('System.setProperty("webdriver.chrome.driver", "/opt/chromedriver");', 'selenium-java-maven', 'A.java'))
        .to.include('error:no-driver-path');
      expect(ids('WebDriverManager.chromedriver().setup();', 'selenium-java-maven', 'A.java')).to.include('error:no-driver-manager');
      expect(ids('var driver = new ChromeDriver(@"C:\\\\drivers");', 'selenium-csharp-nunit', 'A.cs')).to.include('error:no-driver-path');
    });

    it('rejects Selenium 3 APIs and DesiredCapabilities', () => {
      expect(ids('driver.find_element_by_id("q")')).to.include('error:no-selenium3-api');
      expect(ids('driver.switch_to_alert()')).to.include('error:no-selenium3-api');
      expect(ids('DesiredCapabilities caps = DesiredCapabilities.chrome();', 'selenium-java-maven', 'A.java'))
        .to.include('error:no-desired-capabilities');
      expect(ids('options.AddAdditionalCapability("x", true);', 'selenium-csharp-nunit', 'A.cs')).to.include('error:no-desired-capabilities');
    });

    it('rejects the old headless API and Java TimeUnit timeouts', () => {
      expect(ids('options.headless = True')).to.include('error:old-headless');
      expect(ids('options.add_argument("--headless")')).to.include('error:old-headless');
      expect(ids('options.setHeadless(true);', 'selenium-java-maven', 'A.java')).to.include('error:old-headless');
      expect(ids('driver.manage().timeouts().implicitlyWait(10, TimeUnit.SECONDS);', 'selenium-java-maven', 'A.java'))
        .to.include('error:java-timeunit-timeout');
    });

    it('warns about an implicit wait, and makes it an error when mixed with explicit waits', () => {
      expect(ids('driver.implicitly_wait(10)')).to.deep.equal(['warning:no-implicit-wait']);
      const mixed = 'driver.implicitly_wait(10)\nWebDriverWait(driver, 10).until(EC.title_is("x"))';
      expect(ids(mixed)).to.deep.equal(['error:no-implicit-wait']);
    });

    it('warns about absolute XPath, JavaScript clicks and CDP', () => {
      expect(ids('driver.find_element(By.XPATH, "/html/body/div[3]/span")')).to.include('warning:no-absolute-xpath');
      expect(ids('driver.execute_script("arguments[0].click();", el)')).to.include('warning:no-js-click');
      expect(ids('driver.execute_cdp_cmd("Network.enable", {})')).to.include('warning:no-cdp');
    });

    it('does not check Playwright code', () => {
      expect(rules('await page.waitForTimeout(1000)', 'playwright-js', 'a.spec.ts')).to.deep.equal([]);
    });

    describe('WebdriverIO', () => {
      const wdio = (code: string) => ids(code, 'webdriverio-ts', 'cart.ts');
      it('accepts WebdriverIO waits and retrying matchers', () => {
        const code = [
          "await $('#start button').click();",
          "await $('#loading').waitForDisplayed({ reverse: true });",
          "await $('#field').waitForEnabled();",
          "await browser.waitUntil(async () => (await $$('.row').length) === 3);",
          "await expect($('#finish h4')).toHaveText('Hello World!');",
          '// never browser.pause(5000) here: a comment does not count',
        ].join('\n');
        expect(wdio(code)).to.deep.equal([]);
      });
      it('rejects browser.pause and promise sleeps', () => {
        expect(wdio('await browser.pause(5000);')).to.deep.equal(['error:wdio-no-pause']);
        expect(wdio('await driver.pause(200)')).to.deep.equal(['error:wdio-no-pause']);
        expect(wdio('await new Promise(r => setTimeout(r, 500));')).to.deep.equal(['error:wdio-no-pause']);
      });
      it('rejects sync mode and v4 APIs, warns about implicit timeouts and absolute XPath', () => {
        expect(wdio("services: ['@wdio/sync'],")).to.include('error:wdio-sync-mode');
        expect(wdio("browser.element('#q').click()")).to.include('error:wdio-sync-mode');
        expect(wdio('await browser.setTimeout({ implicit: 5000 })')).to.deep.equal(['warning:wdio-no-implicit-timeout']);
        expect(wdio("await $('/html/body/div[2]').click()")).to.deep.equal(['warning:no-absolute-xpath']);
      });
      it('does not apply Selenium-only rules such as driver.sleep wording or DesiredCapabilities', () => {
        expect(wdio('const caps = { browserName: "chrome" };')).to.deep.equal([]);
      });
      it("reports with WebdriverIO's docs link", () => {
        const report = formatRuleViolations(rules('await browser.pause(1000)', 'webdriverio-ts', 'a.ts'), 'a.ts')!;
        expect(report).to.include('WebdriverIO rules (https://webdriver.io/docs/bestpractices)');
        expect(report).to.include('line 1 [wdio-no-pause]');
      });
    });

    it('formats a report with line numbers and the docs link', () => {
      const report = formatRuleViolations(rules('x = 1\ntime.sleep(1)\n'), 'test_x.py')!;
      expect(report).to.include('1 error(s), 0 warning(s) in test_x.py');
      expect(report).to.include('line 2 [no-sleep] time.sleep(1)');
      expect(report).to.include('selenium.dev/documentation/ai_agents');
      expect(formatRuleViolations([], 'x')).to.equal(null);
    });
  });
});
