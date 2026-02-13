import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { getTestsDir, resolveOutputDir } from '../../utils/paths.js';
import {
  TestManifest, RunCommand, SeedTestEntry,
  readManifest, writeManifest,
} from '../../types/manifest.js';
import { extractSelectors, validateSelectorsLive } from '../../utils/selector-validation.js';
import { validateOutputPath } from '../../utils/sandbox.js';

/**
 * Detect the run command for a framework based on common conventions.
 * Returns a suggestion that the LLM can override.
 */
function suggestRunCommand(framework: string, configFile: string | null): RunCommand | null {
  const suggestions: Record<string, RunCommand> = {
    'webdriverio-ts': { command: 'npx', args: ['wdio', 'run', configFile || 'wdio.conf.ts'] },
    'webdriverio-js': { command: 'npx', args: ['wdio', 'run', configFile || 'wdio.conf.js'] },
    'playwright-js': { command: 'npx', args: ['playwright', 'test'] },
    'playwright-python': { command: 'pytest', args: ['-v', '--tb=short'] },
    'pytest': { command: 'pytest', args: ['-v', '--tb=short'] },
    'selenium-python-pytest': { command: 'pytest', args: ['-v', '--tb=short'] },
    'robot-framework': { command: 'robot', args: ['--outputdir', 'results'] },
    'selenium-js-jest': { command: 'npx', args: ['jest', '--verbose'] },
    'selenium-js-mocha': { command: 'npx', args: ['mocha', '--reporter', 'spec'] },
    'selenium-java-maven': { command: 'mvn', args: ['test'] },
    'selenium-java-gradle': { command: 'gradle', args: ['test'] },
    'selenium-csharp-nunit': { command: 'dotnet', args: ['test'] },
    'selenium-csharp-mstest': { command: 'dotnet', args: ['test'] },
    'selenium-csharp-xunit': { command: 'dotnet', args: ['test'] },
  };
  return suggestions[framework] || null;
}

/**
 * Try to find a framework config file in the project root.
 */
async function detectConfigFile(projectRoot: string): Promise<string | null> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const candidates = [
    'wdio.conf.ts', 'wdio.conf.js',
    'playwright.config.ts', 'playwright.config.js',
    'pytest.ini', 'pyproject.toml', 'setup.cfg',
    'robot.yaml',
    'pom.xml', 'build.gradle', 'build.gradle.kts',
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(path.join(projectRoot, candidate));
      return candidate;
    } catch { /* not found */ }
  }
  return null;
}

// ============================================================================
// Generator Setup Tool
// ============================================================================

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

// ============================================================================
// Generator Read Log Tool
// ============================================================================

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

// ============================================================================
// Generator Write Test Tool
//
// Now persists a .test-manifest.json alongside the test files.
// The manifest records framework, run command, config, and test file list
// so the healer can pick it up later without rediscovering everything.
// ============================================================================

const writeTestSchema = z.object({
  testCode: z.string().describe('Generated test code'),
  filename: z.string().describe('Filename for the test file'),
  framework: z.string().describe('Test framework'),
  outputDir: z.string().optional().describe('Output directory for test files (default: framework-conventional directory)'),
  projectRoot: z.string().optional().describe('Project root directory (for manifest). If omitted, uses outputDir parent.'),
  baseUrl: z.string().optional().describe('Base URL of the application under test'),
  runCommand: z.object({
    command: z.string(),
    args: z.array(z.string()),
  }).optional().describe('Custom run command override. If omitted, a default is suggested based on framework.'),
  configFile: z.string().optional().describe('Path to framework config file (e.g. wdio.conf.ts, playwright.config.ts). Auto-detected if omitted.'),
  verify: z.boolean().optional().describe('Validate selectors against the live page before writing (default: true)'),
  specFile: z.string().optional().describe('Path to the spec file this test was generated from'),
});

export class GeneratorWriteTestTool extends BaseTool {
  readonly name = 'generator_write_test';
  readonly description = `Save generated test code to a file and update the .test-manifest.json.

The manifest records everything the healer needs to run tests later:
- framework, run command, config file, project root, base URL
- list of all generated test files

This means the healer can read the manifest and immediately know how to execute tests
without the LLM having to re-analyze the project each time.

The LLM can provide a custom runCommand, or let the tool suggest one based on the framework.`;
  readonly inputSchema = writeTestSchema;
  readonly category: ToolCategory = 'agent';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const {
      testCode, filename, framework, outputDir,
      projectRoot: explicitProjectRoot, baseUrl, runCommand, configFile: explicitConfig,
      verify, specFile,
    } = this.parseParams(writeTestSchema, params);

    const fs = await import('fs/promises');
    const path = await import('path');

    // Find or create tests directory
    const testsDir = resolveOutputDir(outputDir, getTestsDir());

    try {
      // Selector verification (non-blocking — file still written even if some fail)
      let validationReport: string | undefined;
      if (verify !== false) {
        try {
          const selectors = extractSelectors(testCode);
          if (selectors.length > 0) {
            const driver = await context.getDriver();
            const results = await validateSelectorsLive(driver, selectors);
            const invalid = results.filter(r => !r.valid);
            if (invalid.length > 0) {
              validationReport = `Selector validation: ${results.length - invalid.length}/${results.length} valid. ` +
                `Invalid: ${invalid.map(r => `"${r.selector}"`).join(', ')}`;
            } else {
              validationReport = `Selector validation: all ${results.length} selectors valid`;
            }
          }
        } catch {
          // Validation is non-blocking
        }
      }

      const unrestricted = process.env.SELENIUM_MCP_UNRESTRICTED_FILES === 'true';
      await fs.mkdir(testsDir, { recursive: true });
      const testPath = path.join(testsDir, filename);
      validateOutputPath(testPath, unrestricted);
      await fs.writeFile(testPath, testCode);

      // Clear action history after generating
      context.clearRecording();

      // --- Manifest handling ---
      const projectRoot = explicitProjectRoot || path.dirname(testsDir);
      const detectedConfig = explicitConfig || await detectConfigFile(projectRoot);
      const suggestedRun = runCommand || suggestRunCommand(framework, detectedConfig);

      // Read existing manifest or create new
      let manifest = await readManifest(projectRoot);
      if (manifest) {
        // Update existing manifest
        manifest.framework = framework;
        manifest.baseUrl = baseUrl || manifest.baseUrl;
        manifest.runCommand = suggestedRun || manifest.runCommand;
        manifest.configFile = detectedConfig || manifest.configFile;
        manifest.updatedAt = new Date().toISOString();

        // Add test file if not already listed
        if (!manifest.tests.some(t => t.file === testPath)) {
          manifest.tests.push({
            file: testPath,
            framework,
            createdAt: new Date().toISOString(),
            specFile,
          });
        }
      } else {
        // Create new manifest
        manifest = {
          version: 1,
          projectRoot,
          baseUrl: baseUrl || '',
          framework,
          runCommand: suggestedRun,
          configFile: detectedConfig,
          tests: [{
            file: testPath,
            framework,
            createdAt: new Date().toISOString(),
            specFile,
          }],
          updatedAt: new Date().toISOString(),
        };
      }

      const manifestPath = await writeManifest(projectRoot, manifest);

      const result: Record<string, unknown> = {
        message: 'Test code saved successfully',
        file: testPath,
        framework,
        lines: testCode.split('\n').length,
        manifest: manifestPath,
        runCommand: suggestedRun,
      };
      if (validationReport) {
        result.selectorValidation = validationReport;
      }
      if (specFile) {
        result.specFile = specFile;
      }

      return this.success(JSON.stringify(result, null, 2), false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to save test: ${message}`);
    }
  }
}

// ============================================================================
// Generator Write Seed Test Tool
//
// Writes a seed/bootstrap test (auth, fixtures, env setup) and registers
// it in the manifest under seedTests[].
// ============================================================================

const writeSeedSchema = z.object({
  testCode: z.string().describe('Seed test code (auth helper, fixture setup, etc.)'),
  filename: z.string().describe('Filename for the seed test file'),
  framework: z.string().describe('Test framework'),
  description: z.string().describe('What this seed test does (e.g. "Login and save auth cookies")'),
  outputDir: z.string().optional().describe('Output directory'),
  projectRoot: z.string().optional().describe('Project root directory (for manifest)'),
});

export class GeneratorWriteSeedTestTool extends BaseTool {
  readonly name = 'generator_write_seed';
  readonly description = `Write a seed/bootstrap test (authentication, fixtures, environment setup).

Seed tests are registered in the manifest under seedTests[] and are run before
the main test suite by the healer. Use this for:
- Login/auth flows that save cookies or tokens
- Database seeding scripts
- Environment validation checks`;
  readonly inputSchema = writeSeedSchema;
  readonly category: ToolCategory = 'generator';

  async execute(_context: Context, params: unknown): Promise<ToolResult> {
    const { testCode, filename, framework, description, outputDir, projectRoot: explicitRoot } = this.parseParams(writeSeedSchema, params);

    const fs = await import('fs/promises');
    const path = await import('path');

    const testsDir = resolveOutputDir(outputDir, getTestsDir());

    try {
      const unrestricted = process.env.SELENIUM_MCP_UNRESTRICTED_FILES === 'true';
      await fs.mkdir(testsDir, { recursive: true });
      const seedPath = path.join(testsDir, filename);
      validateOutputPath(seedPath, unrestricted);
      await fs.writeFile(seedPath, testCode);

      // Update manifest
      const projectRoot = explicitRoot || path.dirname(testsDir);
      let manifest = await readManifest(projectRoot);
      if (!manifest) {
        manifest = {
          version: 1,
          projectRoot,
          baseUrl: '',
          framework,
          runCommand: suggestRunCommand(framework, null),
          configFile: null,
          tests: [],
          updatedAt: new Date().toISOString(),
        };
      }

      const seedEntry: SeedTestEntry = {
        file: seedPath,
        framework,
        description,
        createdAt: new Date().toISOString(),
      };

      if (!manifest.seedTests) {
        manifest.seedTests = [];
      }
      if (!manifest.seedTests.some(s => s.file === seedPath)) {
        manifest.seedTests.push(seedEntry);
      }
      manifest.updatedAt = new Date().toISOString();

      const manifestPath = await writeManifest(projectRoot, manifest);

      return this.success(JSON.stringify({
        message: 'Seed test saved',
        file: seedPath,
        description,
        manifest: manifestPath,
      }, null, 2), false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to save seed test: ${message}`);
    }
  }
}
