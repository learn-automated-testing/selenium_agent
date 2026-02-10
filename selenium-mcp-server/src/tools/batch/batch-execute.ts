import { z } from 'zod';
import { BaseTool, ExpectationSchema } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory, Expectation, DEFAULT_EXPECTATIONS } from '../../types.js';

const BatchStepSchema = z.object({
  tool: z.string().describe('Name of the tool to execute'),
  arguments: z.record(z.unknown()).describe('Arguments to pass to the tool'),
  expectation: ExpectationSchema.unwrap().optional().describe('Per-step expectation override'),
  continueOnError: z.boolean().optional().default(false).describe('Continue executing next steps if this step fails'),
});

const schema = z.object({
  steps: z.array(BatchStepSchema).min(1).max(20).describe('Array of tool steps to execute sequentially (max 20)'),
  stopOnFirstError: z.boolean().optional().default(true).describe('Stop execution on the first error'),
  globalExpectation: ExpectationSchema.unwrap().optional().describe('Default expectation applied to all steps unless overridden'),
});

interface StepResult {
  step: number;
  tool: string;
  status: 'success' | 'error' | 'skipped';
  content: string;
}

export class BatchExecuteTool extends BaseTool {
  readonly name = 'batch_execute';
  readonly description = 'Execute multiple tool steps in a single round trip. Intermediate steps skip snapshots by default; the last step includes a snapshot. Max 20 steps. Cannot call batch_execute recursively.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'batch';

  private toolRegistry: BaseTool[] = [];

  setToolRegistry(tools: BaseTool[]): void {
    this.toolRegistry = tools;
  }

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { steps, stopOnFirstError, globalExpectation } = this.parseParams(schema, params);

    // Prevent recursive batch calls
    for (const step of steps) {
      if (step.tool === 'batch_execute') {
        return this.error('Recursive batch_execute calls are not allowed');
      }
    }

    const results: StepResult[] = [];
    let hasError = false;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const isLastStep = i === steps.length - 1;

      // Find the tool
      const tool = this.toolRegistry.find(t => t.name === step.tool);
      if (!tool) {
        const result: StepResult = {
          step: i + 1,
          tool: step.tool,
          status: 'error',
          content: `Unknown tool: ${step.tool}`,
        };
        results.push(result);
        hasError = true;

        if (stopOnFirstError && !step.continueOnError) break;
        continue;
      }

      // Resolve expectation for this step
      const stepExpectation = this.resolveStepExpectation(
        tool,
        step.expectation,
        globalExpectation,
        isLastStep
      );

      try {
        // Strip expectation from step args before executing
        const cleanArgs = { ...step.arguments };
        delete cleanArgs.expectation;

        const toolResult = await tool.execute(context, cleanArgs);

        // Apply expectation-based snapshot control
        let content = toolResult.content;
        const shouldSnapshot = stepExpectation.includeSnapshot ?? toolResult.captureSnapshot;

        if (shouldSnapshot && !toolResult.isError) {
          if (stepExpectation.diffOptions?.enabled) {
            const { snapshot, diff } = await context.captureSnapshotWithDiff(
              stepExpectation.snapshotOptions,
              stepExpectation.diffOptions
            );
            content += diff ? `\n\n[DIFF]\n${diff}` : `\n\n${snapshot}`;
          } else {
            await context.captureSnapshot(stepExpectation.snapshotOptions);
            const snapshotText = context.formatSnapshotAsText(stepExpectation.snapshotOptions);
            content += `\n\n${snapshotText}`;
          }
        }

        // Append console logs if requested
        if (stepExpectation.includeConsole) {
          const logs = context.getConsoleLogs(stepExpectation.consoleOptions);
          if (logs.length > 0) {
            const logText = logs.map(l => `[${l.level}] ${l.message}`).join('\n');
            content += `\n\n[CONSOLE]\n${logText}`;
          }
        }

        const result: StepResult = {
          step: i + 1,
          tool: step.tool,
          status: toolResult.isError ? 'error' : 'success',
          content,
        };
        results.push(result);

        if (toolResult.isError) {
          hasError = true;
          if (stopOnFirstError && !step.continueOnError) break;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const result: StepResult = {
          step: i + 1,
          tool: step.tool,
          status: 'error',
          content: `Error: ${message}`,
        };
        results.push(result);
        hasError = true;

        if (stopOnFirstError && !step.continueOnError) break;
      }
    }

    // Mark skipped steps
    if (results.length < steps.length) {
      for (let i = results.length; i < steps.length; i++) {
        results.push({
          step: i + 1,
          tool: steps[i].tool,
          status: 'skipped',
          content: 'Skipped due to previous error',
        });
      }
    }

    // Build summary
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    const summary = [
      `Batch execution complete: ${successCount} succeeded, ${errorCount} failed, ${skippedCount} skipped`,
      '',
      ...results.map(r => {
        const icon = r.status === 'success' ? '[OK]' : r.status === 'error' ? '[FAIL]' : '[SKIP]';
        return `${icon} Step ${r.step} (${r.tool}): ${r.content}`;
      }),
    ].join('\n');

    return {
      content: summary,
      isError: hasError,
      captureSnapshot: false, // We handle snapshots internally
    };
  }

  private resolveStepExpectation(
    tool: BaseTool,
    stepExpectation?: Expectation,
    globalExpectation?: Expectation,
    isLastStep?: boolean
  ): Expectation {
    const categoryDefaults = DEFAULT_EXPECTATIONS[tool.category];

    // For intermediate steps, default to no snapshot
    // For the last step, use category defaults
    const batchDefaults: Expectation = isLastStep
      ? { ...categoryDefaults }
      : { includeSnapshot: false, includeConsole: false };

    // Layer: batch defaults <- global expectation <- per-step expectation
    return {
      includeSnapshot: stepExpectation?.includeSnapshot ?? globalExpectation?.includeSnapshot ?? batchDefaults.includeSnapshot,
      includeConsole: stepExpectation?.includeConsole ?? globalExpectation?.includeConsole ?? batchDefaults.includeConsole,
      snapshotOptions: stepExpectation?.snapshotOptions ?? globalExpectation?.snapshotOptions,
      consoleOptions: stepExpectation?.consoleOptions ?? globalExpectation?.consoleOptions,
      diffOptions: stepExpectation?.diffOptions ?? globalExpectation?.diffOptions,
    };
  }
}
