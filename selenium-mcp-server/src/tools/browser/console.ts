import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  action: z.enum(['get_logs', 'clear']).describe('Console action: get_logs or clear'),
  level: z.enum(['ALL', 'INFO', 'WARNING', 'SEVERE']).optional().default('ALL').describe('Log level filter')
});

export class ConsoleTool extends BaseTool {
  readonly name = 'console_logs';
  readonly description = 'Get browser console logs or clear console. Uses BiDi event collector when available for cross-browser support, falls back to classic log API.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'browser';
  readonly annotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const parsed = this.parseParams(schema, params);
    const action = parsed.action;
    const level = parsed.level ?? 'ALL';

    if (action === 'get_logs') {
      // Prefer BiDi events when collector is active
      if (context.eventCollector?.isActive) {
        const events = context.eventCollector.getConsoleEvents();
        const levelMap: Record<string, string> = {
          'INFO': 'info',
          'WARNING': 'warn',
          'SEVERE': 'error',
          'ALL': '',
        };
        const bidiLevel = levelMap[level] ?? '';

        const filtered = events
          .filter(e => level === 'ALL' || e.level === bidiLevel)
          .map(e => `[${e.level.toUpperCase()}] ${e.text}`);

        if (filtered.length === 0) {
          return this.success('No console logs found', false);
        }

        return this.success(`Console logs (BiDi):\n${filtered.join('\n')}`, false);
      }

      // Classic fallback
      try {
        const driver = await context.getDriver();
        const logs = await driver.manage().logs().get('browser');
        const filteredLogs = logs
          .filter(log => level === 'ALL' || log.level.name === level)
          .map(log => `[${log.level.name}] ${log.message}`);

        if (filteredLogs.length === 0) {
          return this.success('No console logs found', false);
        }

        return this.success(`Console logs:\n${filteredLogs.join('\n')}`, false);
      } catch (err) {
        return this.success('Console logs not available (may require browser configuration)', false);
      }
    } else if (action === 'clear') {
      // Clear BiDi collector if active
      if (context.eventCollector?.isActive) {
        context.eventCollector.clear();
      }
      try {
        const driver = await context.getDriver();
        await driver.executeScript('console.clear();');
        return this.success('Console cleared', false);
      } catch (err) {
        return this.error('Console clear failed');
      }
    }

    return this.error(`Invalid console action: ${action}`);
  }
}
