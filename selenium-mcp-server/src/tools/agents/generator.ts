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
import { getOutputDir } from '../../utils/paths.js';
import { detectProject } from '../../project-detect.js';
import { checkPlanApproved, looksLikePlanPath } from '../../utils/plan-review.js';
import { findSpec } from './spec.js';
import { chooseReportFormat, reportingFor, withReportArgs, type ReportFormat } from '../../reporting/frameworks.js';
import {
  seleniumRulesFor, checkSeleniumRules, formatRuleViolations, SELENIUM_AI_AGENTS_DOCS,
} from './selenium-rules.js';

/** The framework the generator uses when the user names none. */
export const DEFAULT_FRAMEWORK = 'selenium-python-pytest';

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
    'selenium-python-unittest': { command: 'python', args: ['-m', 'unittest', '-v'] },
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
  testPlan: z.string().describe('Test plan content or path to test plan file. It must be approved by the user (Status: approved)'),
  skipPlanReview: z.boolean().optional()
    .describe('Start from a plan that is still a draft. Only when the user explicitly says to skip the plan review.'),
  framework: z.string().optional()
    .describe('Test framework. Default: the one the project already uses (detected from pom.xml, build.gradle, requirements.txt, pyproject.toml, *.csproj, package.json, *.robot), else selenium-python-pytest. Others: selenium-java-maven, selenium-csharp-nunit, selenium-js-mocha, webdriverio-ts, robot-framework, playwright-js, ...'),
  projectRoot: z.string().optional()
    .describe('Folder of the project the tests go into, to detect its language and test runner (default: the output folder)'),
  reporting: z.enum(['junit', 'allure']).optional()
    .describe('Test report: junit (default: JUnit XML, read by every CI system, ReportPortal and Allure) or allure (Allure results as well; the default when the project already uses Allure)'),
});

/** The run command a framework's tests get, with its report arguments. unittest runs under pytest for JUnit XML. */
export function runCommandWithReport(framework: string, base: RunCommand | null, format: ReportFormat): RunCommand | null {
  if (!base) return null;
  const cmd = framework === 'selenium-python-unittest' && base.command === 'python' && base.args[1] === 'unittest'
    ? { command: 'python', args: ['-m', 'pytest', '-v'] }
    : base;
  return { command: cmd.command, args: withReportArgs(cmd.args, framework, format) };
}

export class GeneratorSetupTool extends BaseTool {
  readonly name = 'generator_setup_page';
  readonly description = `Initialize the test generation session and navigate to the application.

When the user names no language or framework, it uses the project's own: it looks at the build files
(pom.xml / build.gradle → Java with JUnit 5 or TestNG; requirements.txt / pyproject.toml → Python with pytest or
unittest; *.csproj → C# with NUnit, xUnit or MSTest; package.json → JavaScript/TypeScript; *.robot → Robot
Framework) and reports what it found. Only in an empty project does it use the default, Python with pytest
(selenium-python-pytest, tests/test_*.py); say so in one line. When the user asks for another one, use it and its standard folder conventions:
selenium-java-maven (src/test/java/*Test.java), selenium-csharp-nunit, selenium-js-mocha / selenium-js-jest (test/*.test.js),
webdriverio-ts (test/specs/*.spec.ts), robot-framework (tests/*.robot), playwright-js (tests/*.spec.ts), or any other
language or framework the user names (Page Object Model, BDD/Gherkin and data-driven patterns too).

Pass the chosen framework to all subsequent generator and healer tool calls.

Tests are only generated from a plan the user has approved. A plan that is still a draft (Status: draft, as
planner_save_plan saves every plan) is refused: show it to the user first, and after their approval call
planner_approve_plan.

For Selenium frameworks the result includes Selenium's official rules for AI assistants for that language
(${SELENIUM_AI_AGENTS_DOCS}): follow them. generator_write_test checks every test against them.`;
  readonly inputSchema = setupSchema;
  readonly category: ToolCategory = 'agent';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { url, testPlan, framework: chosen, projectRoot, skipPlanReview, reporting } = this.parseParams(setupSchema, params);

    // The plan must be reviewed first: a test is only as good as the plan it implements.
    let plan = { where: 'given', content: testPlan };
    if (looksLikePlanPath(testPlan)) {
      try {
        const found = await findSpec(testPlan);
        plan = { where: found.file, content: found.content };
      } catch { /* not a file: treat the text as the plan */ }
    }
    const review = checkPlanApproved(plan.content, plan.where, skipPlanReview);
    if (!review.ok) return this.error(review.message!);
    // No framework named: use the project's own language and test runner, else the default.
    const detected = chosen ? null : detectProject(projectRoot || getOutputDir());
    const framework = chosen || detected?.framework || DEFAULT_FRAMEWORK;

    const driver = await context.ensureBrowser();
    await driver.get(url);

    // Enable recording and persist framework choice
    context.startRecording();
    context.generatorFramework = framework;
    const report = chooseReportFormat(reporting, projectRoot || getOutputDir());
    context.generatorReporting = report.format;
    const reportSetup = reportingFor(framework)?.[report.format];

    await context.captureSnapshot();

    const result = {
      message: 'Test generation session initialized',
      url,
      framework,
      frameworkSource: chosen
        ? 'named by the user'
        : detected
          ? `detected: ${detected.language} with ${detected.testRunner} (${detected.evidence})`
          : 'default: no build files found, so Python with pytest',
      ...(detected ? { testRunner: detected.testRunner } : {}),
      recording: true,
      testPlanPreview: testPlan.slice(0, 200) + (testPlan.length > 200 ? '...' : ''),
      planStatus: review.status ?? 'none',
      ...(review.message ? { planReview: review.message } : {}),
      reporting: {
        format: report.format,
        why: report.why,
        ...(reportSetup ? {
          runCommandAdds: reportSetup.args.join(' ') || '(nothing: the runner writes it by default)',
          resultsIn: reportSetup.results,
          projectNeeds: reportSetup.setup.length ? reportSetup.setup : 'nothing',
        } : { note: 'No report setup known for this framework: add its JUnit XML output to the run command.' }),
        planLinks: 'healer_run_tests links every result to its plan scenario through the plan\'s "File:" line (or generator_write_test scenario) and writes reports/junit-plans.xml; Allure results get the plan as epic, the suite as feature and the scenario as story. Write each test to the file its plan scenario names.',
      },
      seleniumRules: undefined as string | undefined,
    };

    // Selenium's official rules for the language the tests are written in, for the agent to follow.
    const rules = seleniumRulesFor(framework);
    result.seleniumRules = rules
      ? 'Follow the rules below. generator_write_test rejects code that breaks them (sleeps, driver paths, ...).'
      : undefined;

    const text = JSON.stringify(result, null, 2) + (rules ? '\n\n' + rules : '');
    return this.success(text, true);
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
  framework: z.string().optional().describe('Test framework (default: the one from generator_setup_page, else selenium-python-pytest)'),
  outputDir: z.string().optional().describe('Output directory for test files (default: framework-conventional directory)'),
  projectRoot: z.string().optional().describe('Project root directory (for manifest). If omitted, uses outputDir parent.'),
  baseUrl: z.string().optional().describe('Base URL of the application under test'),
  runCommand: z.object({
    command: z.string(),
    args: z.array(z.string()),
  }).optional().describe('Custom run command override. If omitted, a default is suggested based on framework.'),
  configFile: z.string().optional().describe('Path to framework config file (e.g. wdio.conf.ts, playwright.config.ts). Auto-detected if omitted.'),
  verify: z.boolean().optional().describe('Validate selectors against the live page before writing (default: true)'),
  specFile: z.string().optional().describe('Path to the spec file this test was generated from (it must be approved)'),
  scenario: z.string().optional().describe('The plan scenario this file implements, e.g. "1.2" (needed only when the file differs from the one the plan names)'),
  skipPlanReview: z.boolean().optional()
    .describe('Write a test for a plan that is still a draft. Only when the user explicitly says to skip the plan review.'),
  allowRuleViolations: z.boolean().optional()
    .describe('Write the file even if it breaks Selenium\'s official rules (sleeps, driver paths, ...). Only when the user explicitly asks for it.'),
});

export class GeneratorWriteTestTool extends BaseTool {
  readonly name = 'generator_write_test';
  readonly description = `Save generated test code to a file and update the .test-manifest.json.

The manifest records everything the healer needs to run tests later:
- framework, run command, config file, project root, base URL
- list of all generated test files

This means the healer can read the manifest and immediately know how to execute tests
without the LLM having to re-analyze the project each time.

The LLM can provide a custom runCommand, or let the tool suggest one based on the framework.

Selenium tests are checked against Selenium's official rules for AI agents (${SELENIUM_AI_AGENTS_DOCS}).
A test with an error (a sleep, a driver manager or driver path, DesiredCapabilities, Selenium 3 APIs, mixed
implicit and explicit waits, ...) is not written: fix the reported lines and call again. Warnings are reported.
With specFile, the plan must be approved by the user: a test for a draft plan is not written.`;
  readonly inputSchema = writeTestSchema;
  readonly category: ToolCategory = 'agent';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const {
      testCode, filename, framework: chosenFramework, outputDir,
      projectRoot: explicitProjectRoot, baseUrl, runCommand, configFile: explicitConfig,
      verify, specFile, allowRuleViolations, skipPlanReview, scenario } = this.parseParams(writeTestSchema, params);

    if (specFile) {
      const spec = await findSpec(specFile).catch(() => null);
      if (spec) {
        const review = checkPlanApproved(spec.content, spec.file, skipPlanReview);
        if (!review.ok) return this.error(`Test not written. ${review.message}`);
      }
    }
    const framework = chosenFramework || context.generatorFramework || DEFAULT_FRAMEWORK;

    const fs = await import('fs/promises');
    const path = await import('path');

    // Find or create tests directory
    const testsDir = resolveOutputDir(outputDir, getTestsDir());

    // Selenium's official rules: errors block the write, warnings are reported.
    const violations = checkSeleniumRules(testCode, framework, filename);
    const ruleReport = formatRuleViolations(violations, filename);
    if (violations.some(v => v.severity === 'error') && !allowRuleViolations) {
      return this.error(`Test not written: it breaks Selenium's official rules.\n${ruleReport}\n` +
        'Fix these lines and call generator_write_test again.');
    }

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
      // The run command writes a test report (JUnit XML; Allure too when chosen), which healer_run_tests links to the plan.
      const existing = await readManifest(projectRoot);
      const reportFormat = context.generatorReporting ?? existing?.reporting ?? 'junit';
      const suggestedRun = runCommand || runCommandWithReport(framework, suggestRunCommand(framework, detectedConfig), reportFormat);

      // Read existing manifest or create new
      let manifest = await readManifest(projectRoot);
      if (manifest) {
        // Update existing manifest
        manifest.framework = framework;
        manifest.baseUrl = baseUrl || manifest.baseUrl;
        // A run command set earlier (e.g. ".venv/bin/pytest") stays unless this call gives a new one.
        manifest.runCommand = runCommand || runCommandWithReport(framework, manifest.runCommand, reportFormat) || suggestedRun;
        manifest.reporting = reportFormat;
        manifest.configFile = detectedConfig || manifest.configFile;
        manifest.updatedAt = new Date().toISOString();

        // Add test file if not already listed
        if (!manifest.tests.some(t => t.file === testPath)) {
          manifest.tests.push({
            file: testPath,
            framework,
            createdAt: new Date().toISOString(),
            specFile,
            ...(scenario ? { scenario } : {}),
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
          reporting: reportFormat,
          tests: [{
            file: testPath,
            framework,
            createdAt: new Date().toISOString(),
            specFile,
            ...(scenario ? { scenario } : {}),
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
        runCommand: manifest.runCommand,
        reporting: manifest.reporting,
      };
      if (validationReport) {
        result.selectorValidation = validationReport;
      }
      if (specFile) {
        result.specFile = specFile;
      }
      result.seleniumRules = ruleReport ?? 'Follows Selenium\'s official rules for AI agents';

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
