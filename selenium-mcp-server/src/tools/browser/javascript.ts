import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  script: z.string().describe('JavaScript code to execute in the browser'),
  args: z.array(z.unknown()).optional().describe('Arguments to pass to the script')
});

export class JavaScriptTool extends BaseTool {
  readonly name = 'execute_javascript';
  readonly description = 'Execute JavaScript code in the browser context. Use "return" to get a value back.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'browser';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { script, args } = this.parseParams(schema, params);

    const driver = await context.getDriver();
    const result = await driver.executeScript(script, ...(args || []));

    let resultStr: string;
    if (result === undefined || result === null) {
      resultStr = 'undefined';
    } else if (typeof result === 'object') {
      resultStr = JSON.stringify(result, null, 2);
    } else {
      resultStr = String(result);
    }

    return this.success(`JavaScript executed. Result: ${resultStr}`, false);
  }
}
