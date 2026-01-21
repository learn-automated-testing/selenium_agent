import { z } from 'zod';
import { spawn } from 'child_process';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

// Healer Run Tests Tool
const runTestsSchema = z.object({
  testPath: z.string().describe('Path to test file or directory to run'),
  framework: z.enum([
    'pytest',
    'selenium-python-pytest',
    'selenium-python-unittest',
    'webdriverio-js',
    'webdriverio-ts',
    'robot-framework',
    'playwright-python',
    'playwright-js',
    'selenium-java-maven',
    'selenium-java-gradle',
    'selenium-js-mocha',
    'selenium-js-jest',
    'selenium-csharp-nunit',
    'selenium-csharp-mstest',
    'selenium-csharp-xunit'
  ]).optional().default('pytest').describe('Test framework to use')
});

export class HealerRunTestsTool extends BaseTool {
  readonly name = 'healer_run_tests';
  readonly description = 'Execute test suite and collect failure information for debugging';
  readonly inputSchema = runTestsSchema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { testPath, framework } = this.parseParams(runTestsSchema, params);

    const frameworkStr = framework || 'pytest';
    const commands: Record<string, string[]> = {
      'pytest': ['pytest', testPath, '-v', '--tb=short'],
      'selenium-python-pytest': ['pytest', testPath, '-v', '--tb=short'],
      'selenium-python-unittest': ['python', '-m', 'unittest', testPath],
      'robot-framework': ['robot', '--outputdir', 'results', testPath],
      'webdriverio-js': ['npx', 'wdio', 'run', testPath],
      'webdriverio-ts': ['npx', 'wdio', 'run', testPath],
      'playwright-python': ['pytest', testPath, '-v', '--tb=short'],
      'playwright-js': ['npx', 'playwright', 'test', testPath],
      'selenium-java-maven': ['mvn', 'test', `-Dtest=${testPath}`],
      'selenium-java-gradle': ['gradle', 'test', '--tests', testPath],
      'selenium-js-mocha': ['npx', 'mocha', testPath, '--reporter', 'spec'],
      'selenium-js-jest': ['npx', 'jest', testPath, '--verbose'],
      'selenium-csharp-nunit': ['dotnet', 'test', testPath, '--filter', 'FullyQualifiedName~'],
      'selenium-csharp-mstest': ['dotnet', 'test', testPath, '--filter', 'FullyQualifiedName~'],
      'selenium-csharp-xunit': ['dotnet', 'test', testPath, '--filter', 'FullyQualifiedName~']
    };

    const cmd = commands[frameworkStr] || commands['pytest'];

    try {
      const result = await this.runCommand(cmd[0], cmd.slice(1));

      return this.success(JSON.stringify({
        message: 'Tests executed',
        exitCode: result.exitCode,
        passed: result.exitCode === 0,
        stdout: result.stdout.slice(0, 5000),
        stderr: result.stderr.slice(0, 2000)
      }, null, 2), false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to run tests: ${message}`);
    }
  }

  private runCommand(command: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, { shell: true });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        resolve({ exitCode: code || 0, stdout, stderr });
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }
}

// Healer Debug Test Tool
const debugTestSchema = z.object({
  testName: z.string().describe('Name of the specific test to debug'),
  testPath: z.string().describe('Path to the test file'),
  framework: z.enum([
    'pytest',
    'selenium-python-pytest',
    'selenium-python-unittest',
    'webdriverio-js',
    'webdriverio-ts',
    'robot-framework',
    'playwright-python',
    'playwright-js',
    'selenium-java-maven',
    'selenium-java-gradle',
    'selenium-js-mocha',
    'selenium-js-jest',
    'selenium-csharp-nunit',
    'selenium-csharp-mstest',
    'selenium-csharp-xunit'
  ]).optional().default('pytest').describe('Test framework to use')
});

export class HealerDebugTestTool extends BaseTool {
  readonly name = 'healer_debug_test';
  readonly description = 'Run a specific test in debug mode with enhanced logging';
  readonly inputSchema = debugTestSchema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { testName, testPath, framework } = this.parseParams(debugTestSchema, params);

    const frameworkStr = framework || 'pytest';
    const commands: Record<string, string[]> = {
      'pytest': ['pytest', `${testPath}::${testName}`, '-vv', '-s', '--tb=long'],
      'selenium-python-pytest': ['pytest', `${testPath}::${testName}`, '-vv', '-s', '--tb=long'],
      'selenium-python-unittest': ['python', '-m', 'unittest', `${testPath}.${testName}`, '-v'],
      'robot-framework': ['robot', '--outputdir', 'results', '--test', testName, testPath],
      'webdriverio-js': ['npx', 'wdio', 'run', testPath, '--spec', testName],
      'webdriverio-ts': ['npx', 'wdio', 'run', testPath, '--spec', testName],
      'playwright-python': ['pytest', `${testPath}::${testName}`, '-vv', '-s', '--tb=long'],
      'playwright-js': ['npx', 'playwright', 'test', testPath, '-g', testName],
      'selenium-java-maven': ['mvn', 'test', `-Dtest=${testPath}#${testName}`],
      'selenium-java-gradle': ['gradle', 'test', '--tests', `${testPath}.${testName}`],
      'selenium-js-mocha': ['npx', 'mocha', testPath, '--grep', testName, '--reporter', 'spec'],
      'selenium-js-jest': ['npx', 'jest', testPath, '-t', testName, '--verbose'],
      'selenium-csharp-nunit': ['dotnet', 'test', testPath, '--filter', `FullyQualifiedName~${testName}`, '-v', 'detailed'],
      'selenium-csharp-mstest': ['dotnet', 'test', testPath, '--filter', `FullyQualifiedName~${testName}`, '-v', 'detailed'],
      'selenium-csharp-xunit': ['dotnet', 'test', testPath, '--filter', `FullyQualifiedName~${testName}`, '-v', 'detailed']
    };

    const cmd = commands[frameworkStr] || commands['pytest'];

    try {
      const result = await this.runCommand(cmd[0], cmd.slice(1));

      return this.success(JSON.stringify({
        message: `Debug run complete for ${testName}`,
        exitCode: result.exitCode,
        passed: result.exitCode === 0,
        stdout: result.stdout.slice(0, 10000),
        stderr: result.stderr.slice(0, 5000)
      }, null, 2), false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to debug test: ${message}`);
    }
  }

  private runCommand(command: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, { shell: true });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        resolve({ exitCode: code || 0, stdout, stderr });
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }
}

// Healer Fix Test Tool
const fixTestSchema = z.object({
  testPath: z.string().describe('Path to the test file to fix'),
  fixedCode: z.string().describe('The corrected test code'),
  fixDescription: z.string().describe('Description of what was fixed')
});

export class HealerFixTestTool extends BaseTool {
  readonly name = 'healer_fix_test';
  readonly description = 'Apply fixes to a test file and save the corrected version';
  readonly inputSchema = fixTestSchema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { testPath, fixedCode, fixDescription } = this.parseParams(fixTestSchema, params);

    const fs = await import('fs/promises');
    const path = await import('path');

    try {
      // Create backup
      const backupPath = `${testPath}.bak`;
      try {
        const original = await fs.readFile(testPath, 'utf-8');
        await fs.writeFile(backupPath, original);
      } catch { /* file might not exist */ }

      // Write fixed code
      await fs.writeFile(testPath, fixedCode);

      const result = {
        message: 'Test fixed and saved',
        file: testPath,
        backup: backupPath,
        fix: fixDescription
      };

      return this.success(JSON.stringify(result, null, 2), false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to fix test: ${message}`);
    }
  }
}

// Browser Generate Locator Tool
const generateLocatorSchema = z.object({
  elementDescription: z.string().describe('Description of the element to find a locator for')
});

export class BrowserGenerateLocatorTool extends BaseTool {
  readonly name = 'browser_generate_locator';
  readonly description = 'Generate a robust locator strategy for a specific element';
  readonly inputSchema = generateLocatorSchema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { elementDescription } = this.parseParams(generateLocatorSchema, params);

    await context.captureSnapshot();
    const snapshot = await context.getSnapshot();

    // Find elements matching description
    const matchingElements: Array<{ ref: string; tag: string; text: string; id?: string }> = [];

    for (const [ref, elem] of snapshot.elements) {
      const text = elem.text?.toLowerCase() || '';
      const ariaLabel = elem.ariaLabel?.toLowerCase() || '';
      const searchTerm = elementDescription.toLowerCase();

      if (text.includes(searchTerm) || ariaLabel.includes(searchTerm)) {
        matchingElements.push({
          ref,
          tag: elem.tagName,
          text: elem.text || '',
          id: elem.attributes['id']
        });
      }
    }

    if (matchingElements.length > 0) {
      const best = matchingElements[0];
      const result = {
        message: `Generated locator for: ${elementDescription}`,
        element: best,
        suggestedLocators: [
          best.id ? `By.id("${best.id}")` : null,
          `By.xpath("//${best.tag}[contains(text(), '${best.text.slice(0, 30)}')]")`,
          `[ref="${best.ref}"]`
        ].filter(Boolean)
      };

      return this.success(JSON.stringify(result, null, 2), false);
    }

    return this.error(`No matching element found for: ${elementDescription}`);
  }
}
