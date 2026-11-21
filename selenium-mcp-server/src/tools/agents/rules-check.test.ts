import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SeleniumRulesCheckTool, scanForRuleViolations } from './rules-check.js';

describe('selenium_rules_check (scan for a migration)', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-')); });
  const write = (f: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), text);
  };

  it('finds Selenium 3 patterns in Python, Java and Robot files, and skips non-Selenium code and vendor folders', () => {
    write('tests/test_login.py', 'from selenium import webdriver\nimport time\n\ndef test_login(driver):\n    driver.find_element_by_id("user").send_keys("a")\n    time.sleep(2)\n');
    write('src/test/java/LoginTest.java', 'import org.openqa.selenium.WebDriver;\nclass LoginTest {\n  void t() { new WebDriverWait(driver, 10); }\n}\n');
    write('tests/login.robot', '*** Test Cases ***\nLogin\n    Open Browser    ${URL}    chrome\n    Sleep    3s\n');
    write('tests/helpers.py', 'def add(a, b):\n    return a + b\n');                       // no Selenium: not checked
    write('node_modules/x/test.js', 'const {Builder} = require("selenium-webdriver"); driver.sleep(1)'); // skipped
    const r = scanForRuleViolations(dir);
    expect(r.checked).to.equal(3);
    const byFile = Object.fromEntries(r.files.map(f => [f.file, f.violations.map(v => v.rule)]));
    expect(byFile[path.join('tests', 'test_login.py')]).to.have.members(['no-selenium3-api', 'no-sleep']);
    expect(byFile[path.join('src', 'test', 'java', 'LoginTest.java')]).to.deep.equal(['java-timeunit-timeout']);
    expect(byFile[path.join('tests', 'login.robot')]).to.deep.equal(['no-sleep']);
  });

  it('reports per rule and per file, with line numbers, and says when nothing is left', async () => {
    write('test_a.py', 'from selenium import webdriver\ndriver.find_element_by_name("q")\ndriver.find_element_by_id("x")\n');
    const tool = new SeleniumRulesCheckTool();
    const report = (await tool.execute({} as never, { path: dir })).content;
    expect(report).to.include('1 Selenium/WebdriverIO file(s) checked, 1 with findings: 2 error(s), 0 warning(s).');
    expect(report).to.include('2 × ERROR [no-selenium3-api]');
    expect(report).to.include('line 2 [no-selenium3-api] driver.find_element_by_name("q")');

    fs.writeFileSync(path.join(dir, 'test_a.py'), 'from selenium.webdriver.common.by import By\ndriver.find_element(By.NAME, "q")\n');
    expect((await tool.execute({} as never, { path: dir })).content).to.include('nothing to migrate');
  });

  it('checks WebdriverIO specs in a WebdriverIO project with its own rules', () => {
    write('package.json', '{"devDependencies":{"@wdio/cli":"^9.20.0","typescript":"^5.9.0"}}');
    write('test/specs/login.e2e.ts', "describe('x', () => { it('y', async () => {\n  await browser.url('/');\n  await browser.pause(3000);\n}); });\n");
    const r = scanForRuleViolations(dir);
    expect(r.files[0].framework).to.equal('webdriverio-ts');
    expect(r.files[0].violations.map(v => v.rule)).to.deep.equal(['wdio-no-pause']);
  });

  it('scans one file, and says when a path does not exist', async () => {
    write('Old.java', 'import org.openqa.selenium.remote.DesiredCapabilities;\nDesiredCapabilities caps = DesiredCapabilities.chrome();\n');
    expect(scanForRuleViolations(path.join(dir, 'Old.java')).files[0].violations.length).to.be.greaterThan(0);
    const missing = await new SeleniumRulesCheckTool().execute({} as never, { path: path.join(dir, 'nope') });
    expect(missing.isError).to.equal(true);
  });
});
