import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context, RecordedAction } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  format: z.enum([
    'pytest',
    'unittest',
    'selenium_python',
    'robot_framework',
    'playwright',
    'webdriverio',
    'selenium_java',
    'selenium_js'
  ]).describe('Script format to generate'),
  testName: z.string().optional().default('test_recorded_scenario').describe('Name for the test function/class'),
  filename: z.string().optional().describe('Optional filename to save the script to'),
  includeSetup: z.boolean().optional().default(true).describe('Include browser setup and teardown code')
});

export class GenerateScriptTool extends BaseTool {
  readonly name = 'generate_script';
  readonly description = 'Generate executable test script from recorded browser actions';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { format, testName, filename, includeSetup } = this.parseParams(schema, params);

    if (context.actionHistory.length === 0) {
      return this.error('No actions recorded. Start recording first with start_recording tool.');
    }

    const testNameStr = testName || 'test_recorded_scenario';
    const includeSetupBool = includeSetup ?? true;

    const generators: Record<string, () => string> = {
      pytest: () => this.generatePytest(context.actionHistory, testNameStr, includeSetupBool),
      unittest: () => this.generateUnittest(context.actionHistory, testNameStr, includeSetupBool),
      selenium_python: () => this.generateSeleniumPython(context.actionHistory, testNameStr, includeSetupBool),
      robot_framework: () => this.generateRobotFramework(context.actionHistory, testNameStr, includeSetupBool),
      playwright: () => this.generatePlaywright(context.actionHistory, testNameStr, includeSetupBool),
      webdriverio: () => this.generateWebdriverIO(context.actionHistory, testNameStr, includeSetupBool),
      selenium_java: () => this.generateSeleniumJava(context.actionHistory, testNameStr, includeSetupBool),
      selenium_js: () => this.generateSeleniumJS(context.actionHistory, testNameStr, includeSetupBool)
    };

    const generator = generators[format];
    if (!generator) {
      return this.error(`Unsupported format: ${format}`);
    }

    const script = generator();

    // Save to file if requested
    if (filename) {
      try {
        const fs = await import('fs/promises');
        await fs.writeFile(filename, script);
        return this.success(`Generated ${format} test script (${context.actionHistory.length} actions).\nSaved to: ${filename}\n\n${script}`, false);
      } catch (err) {
        return this.success(`Generated ${format} test script (${context.actionHistory.length} actions).\nFailed to save to ${filename}\n\n${script}`, false);
      }
    }

    return this.success(`Generated ${format} test script from ${context.actionHistory.length} recorded actions:\n\n${script}`, false);
  }

  private generatePytest(actions: RecordedAction[], testName: string, includeSetup: boolean): string {
    const lines: string[] = [];

    if (includeSetup) {
      lines.push(
        'import pytest',
        'from selenium import webdriver',
        'from selenium.webdriver.common.by import By',
        'from selenium.webdriver.support.ui import WebDriverWait',
        'from selenium.webdriver.support import expected_conditions as EC',
        '',
        '@pytest.fixture',
        'def driver():',
        '    driver = webdriver.Chrome()',
        '    driver.maximize_window()',
        '    yield driver',
        '    driver.quit()',
        '',
        ''
      );
    }

    lines.push(
      `def ${testName}(driver):`,
      '    """Auto-generated test from recorded browser actions."""'
    );

    for (const action of actions) {
      const code = this.actionToSeleniumPython(action);
      if (code) lines.push(`    ${code}`);
    }

    return lines.join('\n');
  }

  private generateUnittest(actions: RecordedAction[], testName: string, includeSetup: boolean): string {
    const lines: string[] = [];
    const className = testName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');

    if (includeSetup) {
      lines.push(
        'import unittest',
        'from selenium import webdriver',
        'from selenium.webdriver.common.by import By',
        '',
        ''
      );
    }

    lines.push(
      `class ${className}(unittest.TestCase):`,
      '    def setUp(self):',
      '        self.driver = webdriver.Chrome()',
      '        self.driver.maximize_window()',
      '',
      '    def tearDown(self):',
      '        self.driver.quit()',
      '',
      `    def ${testName}(self):`,
      '        driver = self.driver'
    );

    for (const action of actions) {
      const code = this.actionToSeleniumPython(action);
      if (code) lines.push(`        ${code}`);
    }

    if (includeSetup) {
      lines.push('', '', "if __name__ == '__main__':", '    unittest.main()');
    }

    return lines.join('\n');
  }

  private generateSeleniumPython(actions: RecordedAction[], testName: string, includeSetup: boolean): string {
    const lines: string[] = [];

    if (includeSetup) {
      lines.push(
        'from selenium import webdriver',
        'from selenium.webdriver.common.by import By',
        '',
        '# Auto-generated test from recorded browser actions',
        'driver = webdriver.Chrome()',
        'driver.maximize_window()',
        '',
        'try:'
      );
    }

    const indent = includeSetup ? '    ' : '';
    for (const action of actions) {
      const code = this.actionToSeleniumPython(action);
      if (code) lines.push(`${indent}${code}`);
    }

    if (includeSetup) {
      lines.push('', 'finally:', '    driver.quit()');
    }

    return lines.join('\n');
  }

  private generateRobotFramework(actions: RecordedAction[], testName: string, includeSetup: boolean): string {
    const lines: string[] = [];
    const testNameDisplay = testName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    if (includeSetup) {
      lines.push(
        '*** Settings ***',
        'Documentation    Auto-generated test from recorded browser actions',
        'Library          SeleniumLibrary',
        'Test Setup       Open Browser To Test Page',
        'Test Teardown    Close Browser',
        '',
        '*** Variables ***',
        '${BROWSER}        Chrome',
        '${TIMEOUT}       10s',
        '',
        '*** Test Cases ***'
      );
    }

    lines.push(testNameDisplay, '    [Documentation]    Auto-generated test scenario');

    for (const action of actions) {
      const code = this.actionToRobotFramework(action);
      if (code) lines.push(`    ${code}`);
    }

    if (includeSetup) {
      lines.push(
        '',
        '*** Keywords ***',
        'Open Browser To Test Page',
        '    Open Browser    about:blank    ${BROWSER}',
        '    Maximize Browser Window',
        '    Set Selenium Timeout    ${TIMEOUT}'
      );
    }

    return lines.join('\n');
  }

  private generatePlaywright(actions: RecordedAction[], testName: string, includeSetup: boolean): string {
    const lines: string[] = [];

    if (includeSetup) {
      lines.push(
        'import asyncio',
        'from playwright.async_api import async_playwright',
        '',
        ''
      );
    }

    lines.push(
      `async def ${testName}():`,
      '    """Auto-generated test from recorded browser actions."""'
    );

    if (includeSetup) {
      lines.push(
        '    async with async_playwright() as p:',
        '        browser = await p.chromium.launch(headless=False)',
        '        page = await browser.new_page()',
        '',
        '        try:'
      );
    }

    const indent = includeSetup ? '            ' : '    ';
    for (const action of actions) {
      const code = this.actionToPlaywright(action);
      if (code) lines.push(`${indent}${code}`);
    }

    if (includeSetup) {
      lines.push(
        '',
        '        finally:',
        '            await browser.close()',
        '',
        '',
        "if __name__ == '__main__':",
        `    asyncio.run(${testName}())`
      );
    }

    return lines.join('\n');
  }

  private generateWebdriverIO(actions: RecordedAction[], testName: string, _includeSetup: boolean): string {
    const lines: string[] = [
      "describe('Auto-generated Test Suite', () => {",
      `    it('${testName.replace(/_/g, ' ')}', async () => {`,
      '        // Auto-generated test from recorded browser actions'
    ];

    for (const action of actions) {
      const code = this.actionToWebdriverIO(action);
      if (code) lines.push(`        ${code}`);
    }

    lines.push('    });', '});');

    return lines.join('\n');
  }

  private generateSeleniumJava(actions: RecordedAction[], testName: string, _includeSetup: boolean): string {
    const className = testName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');

    const lines: string[] = [
      'import org.openqa.selenium.By;',
      'import org.openqa.selenium.WebDriver;',
      'import org.openqa.selenium.chrome.ChromeDriver;',
      '',
      `public class ${className} {`,
      '    public static void main(String[] args) {',
      '        WebDriver driver = new ChromeDriver();',
      '        ',
      '        try {'
    ];

    for (const action of actions) {
      const code = this.actionToSeleniumJava(action);
      if (code) lines.push(`            ${code}`);
    }

    lines.push(
      '        } finally {',
      '            driver.quit();',
      '        }',
      '    }',
      '}'
    );

    return lines.join('\n');
  }

  private generateSeleniumJS(actions: RecordedAction[], testName: string, _includeSetup: boolean): string {
    const lines: string[] = [
      "const { Builder, By, until } = require('selenium-webdriver');",
      '',
      `async function ${testName}() {`,
      '    let driver = await new Builder().forBrowser("chrome").build();',
      '    ',
      '    try {'
    ];

    for (const action of actions) {
      const code = this.actionToSeleniumJS(action);
      if (code) lines.push(`        ${code}`);
    }

    lines.push(
      '    } finally {',
      '        await driver.quit();',
      '    }',
      '}',
      '',
      `${testName}().catch(console.error);`
    );

    return lines.join('\n');
  }

  // Action converters
  private actionToSeleniumPython(action: RecordedAction): string {
    const { tool, params } = action;

    switch (tool) {
      case 'navigate_to':
        return `driver.get("${params.url}")`;
      case 'click_element':
        return `# Click on element ${params.ref}`;
      case 'input_text':
        return `# Type "${params.text}" into element ${params.ref}`;
      case 'take_screenshot':
        return `driver.save_screenshot("${params.filename || 'screenshot.png'}")`;
      default:
        return `# TODO: ${tool} - ${JSON.stringify(params)}`;
    }
  }

  private actionToRobotFramework(action: RecordedAction): string {
    const { tool, params } = action;

    switch (tool) {
      case 'navigate_to':
        return `Go To    ${params.url}`;
      case 'click_element':
        return `# Click Element    ${params.ref}`;
      case 'input_text':
        return `# Input Text    ${params.ref}    ${params.text}`;
      case 'take_screenshot':
        return `Capture Page Screenshot    ${params.filename || 'screenshot.png'}`;
      default:
        return `# TODO: ${tool}`;
    }
  }

  private actionToPlaywright(action: RecordedAction): string {
    const { tool, params } = action;

    switch (tool) {
      case 'navigate_to':
        return `await page.goto("${params.url}")`;
      case 'click_element':
        return `# await page.click("[ref='${params.ref}']")`;
      case 'input_text':
        return `# await page.fill("[ref='${params.ref}']", "${params.text}")`;
      case 'take_screenshot':
        return `await page.screenshot(path="${params.filename || 'screenshot.png'}")`;
      default:
        return `# TODO: ${tool}`;
    }
  }

  private actionToWebdriverIO(action: RecordedAction): string {
    const { tool, params } = action;

    switch (tool) {
      case 'navigate_to':
        return `await browser.url("${params.url}");`;
      case 'click_element':
        return `// await $("[ref='${params.ref}']").click();`;
      case 'input_text':
        return `// await $("[ref='${params.ref}']").setValue("${params.text}");`;
      case 'take_screenshot':
        return `await browser.saveScreenshot("${params.filename || 'screenshot.png'}");`;
      default:
        return `// TODO: ${tool}`;
    }
  }

  private actionToSeleniumJava(action: RecordedAction): string {
    const { tool, params } = action;

    switch (tool) {
      case 'navigate_to':
        return `driver.get("${params.url}");`;
      case 'click_element':
        return `// Click element ${params.ref}`;
      case 'input_text':
        return `// Type into element ${params.ref}`;
      case 'take_screenshot':
        return `// Take screenshot`;
      default:
        return `// TODO: ${tool}`;
    }
  }

  private actionToSeleniumJS(action: RecordedAction): string {
    const { tool, params } = action;

    switch (tool) {
      case 'navigate_to':
        return `await driver.get("${params.url}");`;
      case 'click_element':
        return `// Click element ${params.ref}`;
      case 'input_text':
        return `// Type into element ${params.ref}`;
      case 'take_screenshot':
        return `await driver.takeScreenshot();`;
      default:
        return `// TODO: ${tool}`;
    }
  }
}
