import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  explorationIds: z.array(z.string()).min(1).describe('Exploration IDs to merge (from parallel_explore results)'),
});

export class ExplorationMergeTool extends BaseTool {
  readonly name = 'exploration_merge';
  readonly description = '[Advanced — Grid] Merge results from multiple parallel explorations, deduplicating pages and building a unified site map. Only relevant after parallel_explore.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'grid';
  readonly annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { explorationIds } = this.parseParams(schema, params);
    const { coordinator } = await context.ensureGrid();

    const result = coordinator.merge(explorationIds);

    const lines: string[] = [
      `Merge complete:`,
      `  Total pages found: ${result.totalPages}`,
      `  Unique pages: ${result.uniquePages}`,
      `  Duplicates removed: ${result.duplicatesRemoved}`,
      `  Forms found: ${result.allForms.length}`,
      `  Workflows found: ${result.allWorkflows.length}`,
      '',
      'Site Map:',
    ];

    for (const entry of result.siteMap) {
      const discoverers = entry.discoveredBy.length > 1 ? ` (found by ${entry.discoveredBy.length} explorations)` : '';
      lines.push(`  ${entry.url}`);
      lines.push(`    "${entry.title}" — ${entry.interactiveElements} elements, ${entry.forms} forms, ${entry.links} links${discoverers}`);
    }

    if (result.allWorkflows.length > 0) {
      lines.push('');
      lines.push('Workflows:');
      for (const wf of result.allWorkflows) {
        lines.push(`  - ${wf.name} (${wf.steps.length} steps)`);
      }
    }

    return this.success(lines.join('\n'));
  }
}
