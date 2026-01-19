import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  action: z.enum(['get_requests', 'clear', 'set_offline']).describe('Network action'),
  offline: z.boolean().optional().default(false).describe('Set offline mode (for set_offline action)')
});

export class NetworkTool extends BaseTool {
  readonly name = 'network_monitor';
  readonly description = 'Monitor network requests or control network state';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { action, offline } = this.parseParams(schema, params);

    const driver = await context.getDriver();

    if (action === 'get_requests') {
      try {
        const logs = await driver.manage().logs().get('performance');
        const networkRequests: string[] = [];

        for (const log of logs) {
          try {
            const message = JSON.parse(log.message);
            const method = message?.message?.method || '';
            if (method.includes('Network.')) {
              const params = message?.message?.params;
              if (params?.request) {
                const reqMethod = params.request.method || '';
                const url = params.request.url || '';
                networkRequests.push(`${reqMethod} ${url}`);
              }
            }
          } catch {
            // Skip unparseable logs
          }
        }

        if (networkRequests.length === 0) {
          return this.success('No network requests found', false);
        }

        return this.success(`Network requests:\n${networkRequests.join('\n')}`, false);
      } catch (err) {
        return this.success('Network monitoring not available', false);
      }
    } else if (action === 'clear') {
      try {
        await driver.manage().logs().get('performance');
        return this.success('Network logs cleared', false);
      } catch (err) {
        return this.error('Network logs clear failed');
      }
    } else if (action === 'set_offline') {
      try {
        // Use Chrome DevTools Protocol to set network conditions
        await (driver as any).sendDevToolsCommand('Network.enable', {});
        await (driver as any).sendDevToolsCommand('Network.emulateNetworkConditions', {
          offline: offline,
          latency: 0,
          downloadThroughput: -1,
          uploadThroughput: -1
        });

        const mode = offline ? 'offline' : 'online';
        return this.success(`Network set to ${mode} mode`, false);
      } catch (err) {
        return this.error('Network mode change failed (requires Chrome)');
      }
    }

    return this.error(`Invalid network action: ${action}`);
  }
}
