import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { runDockerCompose, getComposeFilePath } from '../../utils/docker.js';

const schema = z.object({
  chromeNodes: z.number().int().min(0).max(20).optional().default(4).describe('Number of Chrome nodes'),
  firefoxNodes: z.number().int().min(0).max(20).optional().default(1).describe('Number of Firefox nodes'),
});

export class GridScaleTool extends BaseTool {
  readonly name = 'grid_scale';
  readonly description = '[Advanced — Grid] Scale the Selenium Grid to the desired number of browser nodes using docker compose. Only needed for parallel multi-browser testing.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'grid';

  async execute(_context: Context, params: unknown): Promise<ToolResult> {
    const parsed = this.parseParams(schema, params);
    const chromeNodes = parsed.chromeNodes ?? 4;
    const firefoxNodes = parsed.firefoxNodes ?? 1;

    const args = ['up', '-d', '--scale', `chrome-node=${chromeNodes}`, '--scale', `firefox-node=${firefoxNodes}`];

    try {
      const result = await runDockerCompose(args);

      const lines = [
        `Compose file: ${getComposeFilePath()}`,
        '',
        result.exitCode === 0 ? 'Grid scaled successfully.' : `Grid scale failed (exit code ${result.exitCode}).`,
        '',
        `Configuration:`,
        `  - ${chromeNodes} Chrome node(s)`,
        `  - ${firefoxNodes} Firefox node(s)`,
        `  - ${chromeNodes + firefoxNodes} total browser slots`,
      ];

      if (result.stdout.trim()) {
        lines.push('', 'stdout:', result.stdout.trim().slice(0, 3000));
      }
      if (result.stderr.trim()) {
        lines.push('', 'stderr:', result.stderr.trim().slice(0, 3000));
      }

      if (result.exitCode !== 0) {
        return this.error(lines.join('\n'));
      }

      return this.success(lines.join('\n'));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to scale grid: ${message}`);
    }
  }
}
