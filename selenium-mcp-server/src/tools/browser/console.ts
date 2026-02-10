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
  readonly description = 'Get browser console logs or clear console';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'browser';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { action, level } = this.parseParams(schema, params);

    const driver = await context.getDriver();

    if (action === 'get_logs') {
      try {
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
      try {
        await driver.executeScript('console.clear();');
        return this.success('Console cleared', false);
      } catch (err) {
        return this.error('Console clear failed');
      }
    }

    return this.error(`Invalid console action: ${action}`);
  }
}
