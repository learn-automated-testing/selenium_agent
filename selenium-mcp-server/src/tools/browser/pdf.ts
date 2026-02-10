import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  filePath: z.string().describe('Path where to save the PDF file'),
  format: z.enum(['A4', 'Letter', 'Legal']).optional().default('A4').describe('Paper format'),
  landscape: z.boolean().optional().default(false).describe('Use landscape orientation'),
  printBackground: z.boolean().optional().default(true).describe('Include background graphics')
});

export class PDFTool extends BaseTool {
  readonly name = 'pdf_generate';
  readonly description = 'Generate a PDF from the current page';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'browser';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { filePath, format, landscape, printBackground } = this.parseParams(schema, params);

    try {
      const driver = await context.getDriver();

      // Use Chrome DevTools Protocol to generate PDF
      const printOptions: Record<string, unknown> = {
        landscape,
        printBackground,
        paperWidth: format === 'Letter' ? 8.5 : 8.27,
        paperHeight: format === 'Letter' ? 11 : (format === 'Legal' ? 14 : 11.69)
      };

      const result = await (driver as any).sendDevToolsCommand('Page.printToPDF', printOptions);

      // Save PDF to file
      const fs = await import('fs/promises');
      await fs.writeFile(filePath, Buffer.from(result.data, 'base64'));

      return this.success(`PDF saved to ${filePath}`, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`PDF generation failed: ${message}`);
    }
  }
}
