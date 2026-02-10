import { z } from 'zod';
import path from 'path';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  ref: z.string().describe('File input element reference from page snapshot'),
  filePath: z.string().describe('Path to file to upload')
});

export class FileUploadTool extends BaseTool {
  readonly name = 'file_upload';
  readonly description = 'Upload a file through a file input element';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'input';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { ref, filePath } = this.parseParams(schema, params);

    try {
      const fs = await import('fs/promises');

      // Verify file exists
      try {
        await fs.access(filePath);
      } catch {
        return this.error(`File not found: ${filePath}`);
      }

      const element = await context.getElementByRef(ref);
      const absolutePath = path.resolve(filePath);

      await element.sendKeys(absolutePath);

      return this.success(`Uploaded file ${filePath}`, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`File upload failed: ${message}`);
    }
  }
}
