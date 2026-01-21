import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  action: z.enum(['accept', 'dismiss', 'get_text']).describe('Dialog action: accept, dismiss, or get_text'),
  text: z.string().optional().describe('Text to enter in prompt dialog (optional)')
});

export class DialogTool extends BaseTool {
  readonly name = 'dialog_handle';
  readonly description = 'Handle browser dialogs (alert, confirm, prompt)';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { action, text } = this.parseParams(schema, params);

    try {
      const driver = await context.getDriver();
      const alert = await driver.switchTo().alert();

      if (action === 'get_text') {
        const alertText = await alert.getText();
        return this.success(`Dialog text: ${alertText}`, false);
      } else if (action === 'accept') {
        if (text) {
          await alert.sendKeys(text);
        }
        await alert.accept();
        return this.success('Accepted dialog', true);
      } else if (action === 'dismiss') {
        await alert.dismiss();
        return this.success('Dismissed dialog', true);
      }

      return this.error(`Invalid dialog action: ${action}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Dialog handling failed: ${message}`);
    }
  }
}
