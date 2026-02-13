import { z } from 'zod';
import { spawn } from 'child_process';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { TestManifest, findManifest } from '../../types/manifest.js';
import { extractSelectors, validateSelectorsLive } from '../../utils/selector-validation.js';

// ============================================================================
// Shared command runner
// ============================================================================

function runCommand(
  command: string,
  args: string[],
  cwd?: string,
  timeoutMs = 120000
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      shell: true,
      cwd: cwd || process.cwd(),
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error(`Command timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ exitCode: code || 0, stdout, stderr });
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// ============================================================================
// Healer Run Tests Tool
//
// LLM-driven: the caller provides the exact command + args + cwd.
// No hardcoded framework mappings — the LLM reads the project's config
// (package.json, wdio.conf.ts, etc.) and decides how to invoke the tests.
// ============================================================================

const runTestsSchema = z.object({
  command: z.string().optional().describe('The command to run (e.g. "npx", "pytest", "dotnet"). If omitted, reads from .test-manifest.json.'),
  args: z.array(z.string()).optional().describe('Command arguments. If omitted, reads from .test-manifest.json.'),
  cwd: z.string().optional().describe('Working directory (project root). If omitted, reads from .test-manifest.json.'),
  testPath: z.string().optional().describe('Path to test file. Used to locate .test-manifest.json if command/args are not provided. Also appended as --spec arg for wdio.'),
  timeout: z.number().optional().default(120000).describe('Timeout in milliseconds (default: 120000)')
});

export class HealerRunTestsTool extends BaseTool {
  readonly name = 'healer_run_tests';
  readonly description = `Execute a test command and return stdout/stderr for failure analysis.

Two modes:
1. **Explicit**: Provide command + args + cwd directly (LLM has full control)
2. **Manifest**: Provide just testPath — the tool reads .test-manifest.json (created by generator_write_test) to get the run command, project root, and framework automatically.

Manifest mode example:
  { testPath: "/path/to/project/test/specs/tc07.spec.ts" }
  → Finds .test-manifest.json, reads runCommand, appends --spec testPath, runs it.

Explicit mode examples:
  { command: "npx", args: ["wdio", "run", "wdio.conf.ts", "--spec", "test/specs/tc07.spec.ts"], cwd: "/path/to/project" }
  { command: "pytest", args: ["tests/test_login.py", "-v", "--tb=short"], cwd: "/path/to/project" }`;

  readonly inputSchema = runTestsSchema;
  readonly category: ToolCategory = 'agent';

  async execute(_context: Context, params: unknown): Promise<ToolResult> {
    const { command: explicitCmd, args: explicitArgs, cwd: explicitCwd, testPath, timeout } = this.parseParams(runTestsSchema, params);

    let finalCmd: string;
    let finalArgs: string[];
    let finalCwd: string;

    let manifest: TestManifest | null = null;

    if (explicitCmd && explicitArgs) {
      // Explicit mode — LLM provided everything
      finalCmd = explicitCmd;
      finalArgs = explicitArgs;
      finalCwd = explicitCwd || process.cwd();
    } else if (testPath) {
      // Manifest mode — discover from .test-manifest.json
      manifest = await findManifest(testPath);
      if (!manifest) {
        return this.error(
          `No .test-manifest.json found near ${testPath}. ` +
          `Either provide command + args explicitly, or generate tests with generator_write_test first.`
        );
      }
      if (!manifest.runCommand) {
        return this.error(
          `Manifest found but runCommand is empty. Provide command + args explicitly.`
        );
      }

      finalCmd = manifest.runCommand.command;
      finalArgs = [...manifest.runCommand.args, '--spec', testPath];
      finalCwd = explicitCwd || manifest.projectRoot;
    } else {
      return this.error('Provide either (command + args) or testPath.');
    }

    try {
      // Run seed tests first if manifest has them
      if (manifest?.seedTests && manifest.seedTests.length > 0) {
        for (const seed of manifest.seedTests) {
          const seedResult = await runCommand(
            manifest.runCommand!.command,
            [...manifest.runCommand!.args, '--spec', seed.file],
            finalCwd,
            timeout
          );
          if (seedResult.exitCode !== 0) {
            return this.success(JSON.stringify({
              message: 'Seed test failed — skipping main test',
              seedFile: seed.file,
              seedDescription: seed.description,
              exitCode: seedResult.exitCode,
              stdout: seedResult.stdout.slice(0, 4000),
              stderr: seedResult.stderr.slice(0, 2000),
            }, null, 2), false);
          }
        }
      }

      const result = await runCommand(finalCmd, finalArgs, finalCwd, timeout);

      return this.success(JSON.stringify({
        message: 'Tests executed',
        command: `${finalCmd} ${finalArgs.join(' ')}`,
        cwd: finalCwd,
        exitCode: result.exitCode,
        passed: result.exitCode === 0,
        stdout: result.stdout.slice(0, 8000),
        stderr: result.stderr.slice(0, 4000),
      }, null, 2), false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to run tests: ${message}`);
    }
  }
}

// ============================================================================
// Healer Debug Test Tool
//
// Same LLM-driven approach — caller provides the exact debug command.
// Returns more output (larger slice) for detailed analysis.
// ============================================================================

const debugTestSchema = z.object({
  command: z.string().optional().describe('The command to run. If omitted, reads from .test-manifest.json.'),
  args: z.array(z.string()).optional().describe('Command arguments. If omitted, reads from .test-manifest.json.'),
  cwd: z.string().optional().describe('Working directory (project root). If omitted, reads from .test-manifest.json.'),
  testPath: z.string().optional().describe('Path to test file. Used to locate .test-manifest.json if command/args are not provided.'),
  timeout: z.number().optional().default(120000).describe('Timeout in milliseconds (default: 120000)')
});

export class HealerDebugTestTool extends BaseTool {
  readonly name = 'healer_debug_test';
  readonly description = `Run a single test in debug/verbose mode and return detailed output.

Same as healer_run_tests but returns more output (15KB stdout, 8KB stderr) for deeper analysis.

Supports both explicit mode (command + args) and manifest mode (testPath only).
See healer_run_tests for details on both modes.`;

  readonly inputSchema = debugTestSchema;
  readonly category: ToolCategory = 'agent';

  async execute(_context: Context, params: unknown): Promise<ToolResult> {
    const { command: explicitCmd, args: explicitArgs, cwd: explicitCwd, testPath, timeout } = this.parseParams(debugTestSchema, params);

    let finalCmd: string;
    let finalArgs: string[];
    let finalCwd: string;

    if (explicitCmd && explicitArgs) {
      finalCmd = explicitCmd;
      finalArgs = explicitArgs;
      finalCwd = explicitCwd || process.cwd();
    } else if (testPath) {
      const manifest = await findManifest(testPath);
      if (!manifest || !manifest.runCommand) {
        return this.error(
          `No .test-manifest.json with runCommand found near ${testPath}. Provide command + args explicitly.`
        );
      }
      finalCmd = manifest.runCommand.command;
      finalArgs = [...manifest.runCommand.args, '--spec', testPath];
      finalCwd = explicitCwd || manifest.projectRoot;
    } else {
      return this.error('Provide either (command + args) or testPath.');
    }

    try {
      const result = await runCommand(finalCmd, finalArgs, finalCwd, timeout);

      return this.success(JSON.stringify({
        message: 'Debug run complete',
        command: `${finalCmd} ${finalArgs.join(' ')}`,
        cwd: finalCwd,
        exitCode: result.exitCode,
        passed: result.exitCode === 0,
        stdout: result.stdout.slice(0, 15000),
        stderr: result.stderr.slice(0, 8000),
      }, null, 2), false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to debug test: ${message}`);
    }
  }
}

// ============================================================================
// Healer Fix Test Tool
//
// Writes corrected test code to file (with backup).
// The LLM determines what the fix should be.
// ============================================================================

const fixTestSchema = z.object({
  testPath: z.string().describe('Absolute path to the test file to fix'),
  fixedCode: z.string().describe('The corrected test code'),
  fixDescription: z.string().describe('Description of what was fixed'),
  verify: z.boolean().optional().describe('Validate selectors in fixed code before writing (default: false)'),
});

export class HealerFixTestTool extends BaseTool {
  readonly name = 'healer_fix_test';
  readonly description = 'Apply a fix to a test file. Creates a .bak backup before overwriting. The LLM provides the corrected code.';
  readonly inputSchema = fixTestSchema;
  readonly category: ToolCategory = 'agent';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { testPath, fixedCode, fixDescription, verify } = this.parseParams(fixTestSchema, params);

    const fs = await import('fs/promises');

    try {
      // Selector verification (non-blocking)
      let validationReport: string | undefined;
      if (verify) {
        try {
          const selectors = extractSelectors(fixedCode);
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

      // Create backup
      const backupPath = `${testPath}.bak`;
      try {
        const original = await fs.readFile(testPath, 'utf-8');
        await fs.writeFile(backupPath, original);
      } catch { /* file might not exist yet */ }

      // Write fixed code
      await fs.writeFile(testPath, fixedCode);

      const result: Record<string, unknown> = {
        message: 'Test fixed and saved',
        file: testPath,
        backup: backupPath,
        fix: fixDescription,
      };
      if (validationReport) {
        result.selectorValidation = validationReport;
      }

      return this.success(JSON.stringify(result, null, 2), false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to fix test: ${message}`);
    }
  }
}

// ============================================================================
// Browser Generate Locator Tool
// ============================================================================

const generateLocatorSchema = z.object({
  elementDescription: z.string().describe('Description of the element to find a locator for'),
});

export class BrowserGenerateLocatorTool extends BaseTool {
  readonly name = 'browser_generate_locator';
  readonly description = 'Generate a robust locator strategy for a specific element';
  readonly inputSchema = generateLocatorSchema;
  readonly category: ToolCategory = 'agent';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { elementDescription } = this.parseParams(generateLocatorSchema, params);

    await context.captureSnapshot();
    const snapshot = await context.getSnapshot();

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
          id: elem.attributes['id'],
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
          `[ref="${best.ref}"]`,
        ].filter(Boolean),
      };

      return this.success(JSON.stringify(result, null, 2), false);
    }

    return this.error(`No matching element found for: ${elementDescription}`);
  }
}

// ============================================================================
// Healer Inspect Page Tool
//
// Captures a fresh snapshot and compares expected locators vs actual elements.
// Helps understand UI drift before applying a fix.
// ============================================================================

const inspectPageSchema = z.object({
  locators: z.array(z.object({
    name: z.string().describe('Human-readable name for this locator'),
    strategy: z.string().describe('Locator strategy (id, css, xpath, text)'),
    value: z.string().describe('Locator value'),
  })).describe('Expected locators to validate against the live page'),
});

export class HealerInspectPageTool extends BaseTool {
  readonly name = 'healer_inspect_page';
  readonly description = `Inspect the current page and compare expected locators against actual elements.

Use after a test failure to understand UI drift before applying a fix. Reports:
- Found elements (locator still works)
- Missing elements (locator broken, may need update)
- Suggested updated locators based on element discovery`;
  readonly inputSchema = inspectPageSchema;
  readonly category: ToolCategory = 'agent';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { locators } = this.parseParams(inspectPageSchema, params);

    const driver = await context.ensureBrowser();
    await context.captureSnapshot();
    const snapshot = await context.getSnapshot();

    const results: Array<{
      name: string;
      strategy: string;
      value: string;
      status: 'found' | 'missing';
      matchCount?: number;
      suggestion?: string;
    }> = [];

    for (const loc of locators) {
      try {
        let matchCount = 0;

        if (loc.strategy === 'css' || loc.strategy === 'id') {
          const selector = loc.strategy === 'id' ? `#${loc.value}` : loc.value;
          matchCount = await driver.executeScript(
            `return document.querySelectorAll(arguments[0]).length;`,
            selector
          ) as number;
        } else if (loc.strategy === 'xpath') {
          const xpathResult = await driver.executeScript(
            `const r = document.evaluate(arguments[0], document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null); return r.snapshotLength;`,
            loc.value
          ) as number;
          matchCount = xpathResult;
        } else if (loc.strategy === 'text') {
          // Search snapshot elements for text match
          for (const [, info] of snapshot.elements) {
            if (info.text?.includes(loc.value) || info.ariaLabel?.includes(loc.value)) {
              matchCount++;
            }
          }
        }

        if (matchCount > 0) {
          results.push({ name: loc.name, strategy: loc.strategy, value: loc.value, status: 'found', matchCount });
        } else {
          // Try to find a suggestion from the snapshot
          let suggestion: string | undefined;
          const searchTerm = loc.value.toLowerCase();
          for (const [ref, info] of snapshot.elements) {
            const text = (info.text || '').toLowerCase();
            const label = (info.ariaLabel || '').toLowerCase();
            if (text.includes(searchTerm) || label.includes(searchTerm)) {
              const id = info.attributes['id'];
              suggestion = id ? `Try id="${id}" (ref: ${ref})` : `Try ref="${ref}" (${info.tagName}: ${info.text?.slice(0, 30)})`;
              break;
            }
          }
          results.push({ name: loc.name, strategy: loc.strategy, value: loc.value, status: 'missing', suggestion });
        }
      } catch {
        results.push({ name: loc.name, strategy: loc.strategy, value: loc.value, status: 'missing', suggestion: 'Error evaluating locator' });
      }
    }

    const found = results.filter(r => r.status === 'found').length;
    const missing = results.filter(r => r.status === 'missing').length;

    return this.success(JSON.stringify({
      message: `Page inspection complete: ${found} found, ${missing} missing`,
      url: snapshot.url,
      title: snapshot.title,
      totalElements: snapshot.elements.size,
      locatorResults: results,
    }, null, 2), false);
  }
}
