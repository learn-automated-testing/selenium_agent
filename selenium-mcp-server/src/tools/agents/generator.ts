import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

// Generator Setup Tool
const setupSchema = z.object({
  url: z.string().describe('URL of the web application to test'),
  testPlan: z.string().describe('Test plan content or path to test plan file'),
  framework: z.enum([
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
  ]).describe('Test framework to generate code for')
});

export class GeneratorSetupTool extends BaseTool {
  readonly name = 'generator_setup_page';
  readonly description = 'Initialize the test generation session and navigate to the application';
  readonly inputSchema = setupSchema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { url, testPlan, framework } = this.parseParams(setupSchema, params);

    const driver = await context.ensureBrowser();
    await driver.get(url);

    // Enable recording
    context.startRecording();

    await context.captureSnapshot();

    const result = {
      message: 'Test generation session initialized',
      url,
      framework,
      recording: true,
      testPlanPreview: testPlan.slice(0, 200) + (testPlan.length > 200 ? '...' : '')
    };

    return this.success(JSON.stringify(result, null, 2), true);
  }
}

// Generator Read Log Tool
const readLogSchema = z.object({});

export class GeneratorReadLogTool extends BaseTool {
  readonly name = 'generator_read_log';
  readonly description = 'Retrieve the log of all actions performed during test generation session';
  readonly inputSchema = readLogSchema;

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    if (context.actionHistory.length === 0) {
      return this.success(JSON.stringify({ message: 'No actions recorded yet', actions: [] }, null, 2), false);
    }

    const logEntries = context.actionHistory.map((action, i) => ({
      step: i + 1,
      tool: action.tool,
      params: action.params
    }));

    const result = {
      message: `Retrieved ${logEntries.length} actions`,
      actions: logEntries,
      total: logEntries.length
    };

    return this.success(JSON.stringify(result, null, 2), false);
  }
}

// Generator Write Test Tool
const writeTestSchema = z.object({
  testCode: z.string().describe('Generated test code'),
  filename: z.string().describe('Filename for the test file'),
  framework: z.string().optional().default('pytest').describe('Test framework')
});

export class GeneratorWriteTestTool extends BaseTool {
  readonly name = 'generator_write_test';
  readonly description = 'Save generated test code to a file';
  readonly inputSchema = writeTestSchema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { testCode, filename, framework } = this.parseParams(writeTestSchema, params);

    const fs = await import('fs/promises');
    const path = await import('path');

    // Find or create tests directory
    const testsDir = path.join(process.cwd(), 'tests');

    try {
      await fs.mkdir(testsDir, { recursive: true });
      const testPath = path.join(testsDir, filename);
      await fs.writeFile(testPath, testCode);

      // Clear action history after generating
      context.clearRecording();

      const frameworkStr = framework || 'pytest';
      const runCommands: Record<string, string> = {
        'pytest': `pytest ${testPath}`,
        'selenium-python-pytest': `pytest ${testPath}`,
        'selenium-python-unittest': `python -m unittest ${testPath}`,
        'robot-framework': `robot ${testPath}`,
        'webdriverio-js': `npx wdio run ${testPath}`,
        'webdriverio-ts': `npx wdio run ${testPath}`,
        'playwright-python': `pytest ${testPath}`,
        'playwright-js': `npx playwright test ${testPath}`,
        'selenium-java-maven': `mvn test -Dtest=${testPath}`,
        'selenium-java-gradle': `gradle test --tests ${testPath}`,
        'selenium-js-mocha': `npx mocha ${testPath}`,
        'selenium-js-jest': `npx jest ${testPath}`,
        'selenium-csharp-nunit': `dotnet test ${testPath}`,
        'selenium-csharp-mstest': `dotnet test ${testPath}`,
        'selenium-csharp-xunit': `dotnet test ${testPath}`
      };

      const result = {
        message: 'Test code saved successfully',
        file: testPath,
        framework: frameworkStr,
        lines: testCode.split('\n').length,
        runCommand: runCommands[frameworkStr] || `# Run with appropriate test runner for ${frameworkStr}`
      };

      return this.success(JSON.stringify(result, null, 2), false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to save test: ${message}`);
    }
  }
}
