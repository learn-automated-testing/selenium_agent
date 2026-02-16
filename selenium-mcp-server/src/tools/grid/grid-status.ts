import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({});

export class GridStatusTool extends BaseTool {
  readonly name = 'grid_status';
  readonly description = '[Advanced — Grid] Check the status of the Selenium Grid, including available nodes, browsers, and capacity. Only needed for parallel multi-browser testing.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'grid';
  readonly annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    let client;
    try {
      ({ client } = await context.ensureGrid());
    } catch {
      return this.error(
        'Grid is not available.\n\n' +
        'To enable grid tools:\n' +
        '1. Set SELENIUM_GRID_URL environment variable (e.g. http://localhost:4444)\n' +
        '2. Start the grid with grid_start\n' +
        '3. Restart the MCP server so session and parallel tools become available\n\n' +
        'Note: navigate_to works without the grid — it launches a local browser directly.'
      );
    }

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
