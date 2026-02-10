import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { getTestsDir, resolveOutputDir } from '../../utils/paths.js';

// Generator Setup Tool
const setupSchema = z.object({
  url: z.string().describe('URL of the web application to test'),
  testPlan: z.string().describe('Test plan content or path to test plan file'),
  framework: z.string().describe('Test framework (e.g. selenium-python-pytest, playwright-js, webdriverio-ts)')
});

export class GeneratorSetupTool extends BaseTool {
  readonly name = 'generator_setup_page';
  readonly description = `Initialize the test generation session and navigate to the application.

When a framework is provided (e.g., from a skill), use it and apply its standard folder conventions. When no framework is specified, ask the user:

1. Which test framework? (selenium-python-pytest, playwright-js, webdriverio-ts, robot-framework, selenium-js-jest, selenium-js-mocha, selenium-java-maven, etc.)
2. Use the default structure for that framework? Defaults: pytest: tests/test_*.py, playwright: tests/*.spec.ts, webdriverio: test/specs/*.spec.ts, robot-framework: tests/*.robot, jest/mocha: test/*.test.js, java-maven: src/test/java/*Test.java
3. If not default, which pattern? (Page Object Model, BDD/Gherkin, Data-driven, Custom)

Pass the chosen framework to all subsequent generator and healer tool calls.`;
  readonly inputSchema = setupSchema;
  readonly category: ToolCategory = 'agent';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { url, testPlan, framework } = this.parseParams(setupSchema, params);

    const driver = await context.ensureBrowser();
    await driver.get(url);

    // Enable recording and persist framework choice
    context.startRecording();
    context.generatorFramework = framework;

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
  readonly category: ToolCategory = 'agent';

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    if (context.actionHistory.length === 0) {
      return this.success(JSON.stringify({ message: 'No actions recorded yet', actions: [] }, null, 2), false);
    }

    const logEntries = context.actionHistory.map((action, i) => ({
      step: i + 1,
      tool: action.tool,
      params: action.params,
      elements: action.elements
    }));

    const result = {
      message: `Retrieved ${logEntries.length} actions`,
      framework: context.generatorFramework,
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
  framework: z.string().describe('Test framework'),
  outputDir: z.string().optional().describe('Output directory for test files (default: framework-conventional directory)')
});

export class GeneratorWriteTestTool extends BaseTool {
  readonly name = 'generator_write_test';
  readonly description = 'Save generated test code to a file. Use outputDir to place test files in the framework-conventional directory. Organize using the framework\'s standard naming and folder conventions.';
  readonly inputSchema = writeTestSchema;
  readonly category: ToolCategory = 'agent';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { testCode, filename, framework, outputDir } = this.parseParams(writeTestSchema, params);

    const fs = await import('fs/promises');
    const path = await import('path');

    // Find or create tests directory
    const testsDir = resolveOutputDir(outputDir, getTestsDir());

    try {
      await fs.mkdir(testsDir, { recursive: true });
      const testPath = path.join(testsDir, filename);
      await fs.writeFile(testPath, testCode);

      // Clear action history after generating
      context.clearRecording();

      const result = {
        message: 'Test code saved successfully',
        file: testPath,
        framework,
        lines: testCode.split('\n').length
      };

      return this.success(JSON.stringify(result, null, 2), false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to save test: ${message}`);
    }
  }
}
