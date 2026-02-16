import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  baselineId: z.string().describe('Exploration ID to use as baseline'),
  currentId: z.string().describe('Exploration ID to compare against the baseline'),
});

export class ExplorationDiffTool extends BaseTool {
  readonly name = 'exploration_diff';
  readonly description = '[Advanced — Grid] Compare two exploration results to find added, removed, and changed pages. Only relevant after parallel_explore.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'grid';
  readonly annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { baselineId, currentId } = this.parseParams(schema, params);
    const { coordinator } = await context.ensureGrid();

    const diff = coordinator.diff(baselineId, currentId);

    const lines: string[] = [
      `Exploration diff: ${baselineId} -> ${currentId}`,
      '',
    ];

    if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
      lines.push('No differences found.');
    } else {
      if (diff.added.length > 0) {
        lines.push(`Added pages (${diff.added.length}):`);
        for (const url of diff.added) {
          lines.push(`  + ${url}`);
        }
        lines.push('');
      }

      if (diff.removed.length > 0) {
        lines.push(`Removed pages (${diff.removed.length}):`);
        for (const url of diff.removed) {
          lines.push(`  - ${url}`);
        }
        lines.push('');
      }

      if (diff.changed.length > 0) {
        lines.push(`Changed pages (${diff.changed.length}):`);
        for (const { url, elementDiff } of diff.changed) {
          const sign = elementDiff > 0 ? '+' : '';
          lines.push(`  ~ ${url} (${sign}${elementDiff} elements)`);
        }
      }
    }

    return this.success(lines.join('\n'));
  }
}
