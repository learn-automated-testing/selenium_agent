import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({});

export class GridStatusTool extends BaseTool {
  readonly name = 'grid_status';
  readonly description = 'Check the status of the Selenium Grid, including available nodes, browsers, and capacity. Requires SELENIUM_GRID_URL environment variable.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'grid';
  readonly annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    const { client } = await context.ensureGrid();
    const status = await client.getStatus();

    const lines: string[] = [
      `Grid Status: ${status.ready ? 'READY' : 'NOT READY'}`,
      `Message: ${status.message}`,
      `Capacity: ${status.usedSlots}/${status.totalSlots} slots used (${status.availableSlots} available)`,
      '',
      `Nodes (${status.nodes.length}):`,
    ];

    for (const node of status.nodes) {
      const browsers = node.browsers.map(b => `${b.browserName} ${b.browserVersion}`).join(', ');
      lines.push(`  - ${node.id.slice(0, 12)} | ${node.status} | ${node.activeSessions}/${node.maxSessions} sessions | ${browsers}`);
    }

    return this.success(lines.join('\n'));
  }
}
