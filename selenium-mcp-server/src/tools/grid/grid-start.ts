import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { runDockerCompose, getComposeFilePath } from '../../utils/docker.js';

const schema = z.object({
  chromeNodes: z.number().int().min(0).max(20).optional().describe('Number of Chrome nodes to start (uses compose default if omitted)'),
  firefoxNodes: z.number().int().min(0).max(20).optional().describe('Number of Firefox nodes to start (uses compose default if omitted)'),
});

export class GridStartTool extends BaseTool {
  readonly name = 'grid_start';
  readonly description = '[Advanced — Grid] Start the Selenium Grid using docker compose. Only needed for parallel multi-browser testing.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'grid';

  async execute(_context: Context, params: unknown): Promise<ToolResult> {
    const parsed = this.parseParams(schema, params);

    const args = ['up', '-d'];

    if (parsed.chromeNodes !== undefined) {
      args.push('--scale', `chrome-node=${parsed.chromeNodes}`);
    }
    if (parsed.firefoxNodes !== undefined) {
      args.push('--scale', `firefox-node=${parsed.firefoxNodes}`);
    }

    try {
      const result = await runDockerCompose(args);

      const lines = [
        `Compose file: ${getComposeFilePath()}`,
        '',
        result.exitCode === 0 ? 'Grid started successfully.' : `Grid start failed (exit code ${result.exitCode}).`,
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
      return this.error(`Failed to start grid: ${message}`);
    }
  }
}
