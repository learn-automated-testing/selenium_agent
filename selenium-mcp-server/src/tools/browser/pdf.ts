import { z } from 'zod';
import pathModule from 'path';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { getOutputDir } from '../../utils/paths.js';

const PDFS_DIR = 'pdfs';

const schema = z.object({
  filePath: z.string().describe('Filename or absolute path for the PDF (relative names saved to <output>/pdfs/)'),
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

      const printOptions: Record<string, unknown> = {
        landscape,
        printBackground,
        paperWidth: format === 'Letter' ? 8.5 : 8.27,
        paperHeight: format === 'Letter' ? 11 : (format === 'Legal' ? 14 : 11.69)
      };

      const result = await (driver as any).sendDevToolsCommand('Page.printToPDF', printOptions);

      const fs = await import('fs/promises');

      // If filePath is absolute, use it as-is.
      // Otherwise, save to <outputDir>/pdfs/<filePath>
      let savePath: string;
      if (pathModule.isAbsolute(filePath)) {
        savePath = filePath;
      } else {
        const pdfsDir = pathModule.join(getOutputDir(), PDFS_DIR);
        await fs.mkdir(pdfsDir, { recursive: true });
        const safeName = filePath.endsWith('.pdf') ? filePath : `${filePath}.pdf`;
        savePath = pathModule.join(pdfsDir, safeName);
      }

      await fs.writeFile(savePath, Buffer.from(result.data, 'base64'));

      return this.success(`PDF saved to ${savePath}`, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`PDF generation failed: ${message}`);
    }
  }
}
