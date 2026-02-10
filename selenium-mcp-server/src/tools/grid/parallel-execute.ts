import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { SessionContext } from '../../grid/session-context.js';

const StepSchema = z.object({
  tool: z.string().describe('Name of the tool to execute'),
  arguments: z.record(z.unknown()).describe('Arguments to pass to the tool'),
});

const TaskSchema = z.object({
  sessionId: z.string().optional().describe('Existing session ID to use. If omitted, a new session is created.'),
  browser: z.string().optional().default('chrome').describe('Browser for new session (ignored if sessionId provided)'),
  tags: z.array(z.string()).optional().default([]).describe('Tags for new session (ignored if sessionId provided)'),
  steps: z.array(StepSchema).min(1).max(20).describe('Steps to execute sequentially in this session'),
});

const schema = z.object({
  tasks: z.array(TaskSchema).min(1).max(10).describe('Tasks to execute in parallel — each runs in its own browser session'),
  destroyCreatedSessions: z.boolean().optional().default(false).describe('Destroy sessions that were created for this execution'),
});

export class ParallelExecuteTool extends BaseTool {
  readonly name = 'parallel_execute';
  readonly description = 'Execute multiple tasks in parallel across Selenium Grid sessions. Each task runs its steps sequentially in its own browser session. Cannot call parallel_execute or batch_execute recursively.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'grid';

  private toolRegistry: BaseTool[] = [];

  setToolRegistry(tools: BaseTool[]): void {
    this.toolRegistry = tools;
  }

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { tasks, destroyCreatedSessions } = this.parseParams(schema, params);
    const { pool } = await context.ensureGrid();

    const createdSessionIds: string[] = [];

    // Phase 1: Resolve sessions — create new ones in parallel
    type ResolvedTask = {
      taskIndex: number;
      sessionId: string;
      steps: z.infer<typeof StepSchema>[];
    };
    type FailedTask = {
      taskIndex: number;
      sessionId: string;
      status: 'failed';
      error: string;
      stepResults: never[];
    };

    const resolvedTasks: ResolvedTask[] = [];
    const failedTasks: FailedTask[] = [];

    // Separate tasks that need new sessions from those using existing ones
    const needsNewSession: { taskIndex: number; browser: string; tags: string[]; steps: z.infer<typeof StepSchema>[] }[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (task.sessionId) {
        const existing = pool.getSession(task.sessionId);
        if (!existing) {
          failedTasks.push({
            taskIndex: i,
            sessionId: task.sessionId || '',
            status: 'failed',
            error: `Session "${task.sessionId}" not found`,
            stepResults: [],
          });
        } else {
          resolvedTasks.push({ taskIndex: i, sessionId: task.sessionId, steps: task.steps });
        }
      } else {
        needsNewSession.push({ taskIndex: i, browser: task.browser ?? 'chrome', tags: task.tags ?? [], steps: task.steps });
      }
    }

    // Create all new sessions in parallel
    if (needsNewSession.length > 0) {
      const creationResults = await Promise.allSettled(
        needsNewSession.map(async (task) => {
          const session = await pool.createSession(
            { browserName: task.browser },
            undefined,
            task.tags
          );
          return { taskIndex: task.taskIndex, sessionId: session.sessionId, steps: task.steps };
        })
      );

      for (let i = 0; i < creationResults.length; i++) {
        const result = creationResults[i];
        if (result.status === 'fulfilled') {
          resolvedTasks.push(result.value);
          createdSessionIds.push(result.value.sessionId);
        } else {
          failedTasks.push({
            taskIndex: needsNewSession[i].taskIndex,
            sessionId: '',
            status: 'failed',
            error: `Session creation failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
            stepResults: [],
          });
        }
      }
    }

    // Phase 2: Execute all resolved tasks in parallel
    const taskPromises = resolvedTasks.map(async (resolved) => {
      const gridSession = pool.getSession(resolved.sessionId)!;
      const sessionContext = new SessionContext(gridSession);

      const stepResults: { step: number; tool: string; status: 'success' | 'error' | 'skipped'; content: string }[] = [];

      for (let i = 0; i < resolved.steps.length; i++) {
        const step = resolved.steps[i];

        // Block recursive calls
        if (step.tool === 'parallel_execute' || step.tool === 'batch_execute') {
          stepResults.push({
            step: i + 1,
            tool: step.tool,
            status: 'error',
            content: `Recursive ${step.tool} calls are not allowed`,
          });
          for (let j = i + 1; j < resolved.steps.length; j++) {
            stepResults.push({ step: j + 1, tool: resolved.steps[j].tool, status: 'skipped', content: 'Skipped due to previous error' });
          }
          break;
        }

        const tool = this.toolRegistry.find(t => t.name === step.tool);
        if (!tool) {
          stepResults.push({ step: i + 1, tool: step.tool, status: 'error', content: `Unknown tool: ${step.tool}` });
          for (let j = i + 1; j < resolved.steps.length; j++) {
            stepResults.push({ step: j + 1, tool: resolved.steps[j].tool, status: 'skipped', content: 'Skipped due to previous error' });
          }
          break;
        }

        try {
          const result = await tool.execute(sessionContext, step.arguments);
          stepResults.push({
            step: i + 1,
            tool: step.tool,
            status: result.isError ? 'error' : 'success',
            content: result.content,
          });
          if (result.isError) {
            for (let j = i + 1; j < resolved.steps.length; j++) {
              stepResults.push({ step: j + 1, tool: resolved.steps[j].tool, status: 'skipped', content: 'Skipped due to previous error' });
            }
            break;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          stepResults.push({ step: i + 1, tool: step.tool, status: 'error', content: `Error: ${message}` });
          for (let j = i + 1; j < resolved.steps.length; j++) {
            stepResults.push({ step: j + 1, tool: resolved.steps[j].tool, status: 'skipped', content: 'Skipped due to previous error' });
          }
          break;
        }
      }

      const hasError = stepResults.some(r => r.status === 'error');
      return {
        taskIndex: resolved.taskIndex,
        sessionId: resolved.sessionId,
        status: hasError ? 'failed' as const : 'completed' as const,
        error: undefined as string | undefined,
        stepResults,
      };
    });

    const settled = await Promise.allSettled(taskPromises);
    const executionResults = settled.map((s, i) =>
      s.status === 'fulfilled' ? s.value : {
        taskIndex: resolvedTasks[i].taskIndex,
        sessionId: resolvedTasks[i].sessionId,
        status: 'failed' as const,
        error: s.reason instanceof Error ? s.reason.message : String(s.reason),
        stepResults: [] as { step: number; tool: string; status: 'success' | 'error' | 'skipped'; content: string }[],
      }
    );

    // Combine failed + executed, sort by taskIndex
    const results = [...failedTasks, ...executionResults].sort((a, b) => a.taskIndex - b.taskIndex);

    // Cleanup created sessions if requested
    if (destroyCreatedSessions && createdSessionIds.length > 0) {
      await Promise.allSettled(createdSessionIds.map(id => pool.destroySession(id)));
    }

    // Build summary
    const completed = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'failed').length;

    const lines: string[] = [
      `Parallel execution complete: ${completed} completed, ${failed} failed`,
      '',
    ];

    for (const result of results) {
      lines.push(`--- Task ${result.taskIndex + 1} (session: ${result.sessionId}) ---`);
      lines.push(`  Status: ${result.status}`);
      if (result.error) {
        lines.push(`  Error: ${result.error}`);
      }
      for (const sr of result.stepResults) {
        const icon = sr.status === 'success' ? '[OK]' : sr.status === 'error' ? '[FAIL]' : '[SKIP]';
        lines.push(`  ${icon} Step ${sr.step} (${sr.tool}): ${sr.content.split('\n')[0].slice(0, 100)}`);
      }
      lines.push('');
    }

    if (destroyCreatedSessions && createdSessionIds.length > 0) {
      lines.push(`Cleaned up ${createdSessionIds.length} auto-created session(s).`);
    }

    return this.success(lines.join('\n'));
  }
}
