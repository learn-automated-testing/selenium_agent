import { z } from 'zod';
import pathModule from 'path';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { getOutputDir } from '../../utils/paths.js';
import { getBidiContext } from '../../utils/bidi-helpers.js';
import { validateOutputPath } from '../../utils/sandbox.js';

const PDFS_DIR = 'pdfs';

const schema = z.object({
  filePath: z.string().optional().describe('Filename or absolute path for the PDF. When omitted in stdout mode, returns PDF as base64 resource.'),
  format: z.enum(['A4', 'Letter', 'Legal']).optional().default('A4').describe('Paper format'),
  landscape: z.boolean().optional().default(false).describe('Use landscape orientation'),
  printBackground: z.boolean().optional().default(true).describe('Include background graphics'),
  scale: z.number().min(0.1).max(2).optional().describe('Scale factor (0.1-2, default: 1)'),
  pageRanges: z.string().optional().describe('Page ranges to print (e.g. "1-3,5")'),
});

export class PDFTool extends BaseTool {
  readonly name = 'pdf_generate';
  readonly description = 'Generate a PDF from the current page. Uses BiDi printPage for cross-browser support (Chrome, Firefox, Edge), falls back to CDP.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'browser';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { filePath, format, landscape, printBackground, scale, pageRanges } = this.parseParams(schema, params);

    const outputMode = context.getOutputMode();

    try {
      const driver = await context.getDriver();

      const paperWidth = format === 'Letter' ? 8.5 : 8.27;
      const paperHeight = format === 'Letter' ? 11 : (format === 'Legal' ? 14 : 11.69);

      let pdfBase64: string | null = null;

      // Try BiDi printPage first (cross-browser: Chrome, Firefox, Edge)
      const bidi = await getBidiContext(driver);
      if (bidi) {
        try {
          const printParams: Record<string, unknown> = {
            orientation: landscape ? 'landscape' : 'portrait',
            background: printBackground,
            page: {
              width: paperWidth * 2.54, // inches to cm
              height: paperHeight * 2.54,
            },
          };
          if (scale !== undefined) {
            printParams.scale = scale;
          }
          if (pageRanges) {
            printParams.pageRanges = pageRanges.split(',').map(r => r.trim());
          }

          pdfBase64 = await bidi.browsingContext.printPage(printParams);
        } catch {
          // BiDi printPage failed, try CDP fallback
        }
      }

      // CDP fallback (Chrome-only)
      if (!pdfBase64) {
        const printOptions: Record<string, unknown> = {
          landscape,
          printBackground,
          paperWidth,
          paperHeight,
        };
        if (scale !== undefined) {
          printOptions.scale = scale;
        }
        if (pageRanges) {
          printOptions.pageRanges = pageRanges;
        }

        const result = await (driver as any).sendDevToolsCommand('Page.printToPDF', printOptions);
        pdfBase64 = result.data;
      }

      if (!pdfBase64) {
        return this.error('PDF generation failed: no data returned from BiDi or CDP');
      }

      // If no filePath and stdout mode, return as base64 resource
      if (!filePath && outputMode === 'stdout') {
        return this.successWithResource('PDF generated', pdfBase64, 'application/pdf');
      }

      // Save to file
      const fs = await import('fs/promises');

      let savePath: string;
      const name = filePath || `page-${Date.now()}.pdf`;
      if (pathModule.isAbsolute(name)) {
        savePath = name;
      } else {
        const pdfsDir = pathModule.join(getOutputDir(), PDFS_DIR);
        await fs.mkdir(pdfsDir, { recursive: true });
        const safeName = name.endsWith('.pdf') ? name : `${name}.pdf`;
        savePath = pathModule.join(pdfsDir, safeName);
      }

      const unrestricted = process.env.SELENIUM_MCP_UNRESTRICTED_FILES === 'true';
      validateOutputPath(savePath, unrestricted);
      await fs.writeFile(savePath, Buffer.from(pdfBase64, 'base64'));

      return this.success(`PDF saved to ${savePath}`, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`PDF generation failed: ${message}`);
    }
  }
}
