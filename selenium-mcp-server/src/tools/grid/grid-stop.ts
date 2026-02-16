import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { runDockerCompose, getComposeFilePath } from '../../utils/docker.js';

const schema = z.object({});

export class GridStopTool extends BaseTool {
  readonly name = 'grid_stop';
  readonly description = '[Advanced — Grid] Stop the Selenium Grid by running docker compose down. Only needed for parallel multi-browser testing.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'grid';

  async execute(_context: Context, _params: unknown): Promise<ToolResult> {
    try {
      const result = await runDockerCompose(['down']);

      const lines = [
        `Compose file: ${getComposeFilePath()}`,
        '',
        result.exitCode === 0 ? 'Grid stopped successfully.' : `Grid stop failed (exit code ${result.exitCode}).`,
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
      return this.error(`Failed to stop grid: ${message}`);
    }
  }
}
