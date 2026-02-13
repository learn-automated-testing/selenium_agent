import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { getSpecsDir } from '../../utils/paths.js';
import { validateOutputPath } from '../../utils/sandbox.js';

// ============================================================================
// Generator Save Spec Tool
// ============================================================================

const saveSpecSchema = z.object({
  title: z.string().describe('Spec title (used as filename slug)'),
  content: z.string().describe('Markdown spec content'),
  outputDir: z.string().optional().describe('Override output directory for specs'),
});

export class GeneratorSaveSpecTool extends BaseTool {
  readonly name = 'generator_save_spec';
  readonly description = `Save a structured markdown spec to the specs directory.

Specs capture test requirements in a human-readable format before generating test code.
Saved to <outputDir>/specs/<title-slug>.md`;
  readonly inputSchema = saveSpecSchema;
  readonly category: ToolCategory = 'generator';

  async execute(_context: Context, params: unknown): Promise<ToolResult> {
    const { title, content, outputDir } = this.parseParams(saveSpecSchema, params);

    const fs = await import('fs/promises');
    const path = await import('path');

    const specsDir = outputDir || getSpecsDir();
    await fs.mkdir(specsDir, { recursive: true });

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const filename = `${slug}.md`;
    const specPath = path.join(specsDir, filename);

    const unrestricted = process.env.SELENIUM_MCP_UNRESTRICTED_FILES === 'true';
    validateOutputPath(specPath, unrestricted);
    await fs.writeFile(specPath, content);

    return this.success(JSON.stringify({
      message: 'Spec saved',
      file: specPath,
      title,
    }, null, 2), false);
  }
}

// ============================================================================
// Generator Read Spec Tool
// ============================================================================

const readSpecSchema = z.object({
  specFile: z.string().describe('Path to the spec file to read'),
});

export class GeneratorReadSpecTool extends BaseTool {
  readonly name = 'generator_read_spec';
  readonly description = 'Read a spec file from the specs directory';
  readonly inputSchema = readSpecSchema;
  readonly category: ToolCategory = 'generator';

  async execute(_context: Context, params: unknown): Promise<ToolResult> {
    const { specFile } = this.parseParams(readSpecSchema, params);

    const fs = await import('fs/promises');

    try {
      const content = await fs.readFile(specFile, 'utf-8');
      return this.success(JSON.stringify({
        message: 'Spec loaded',
        file: specFile,
        content,
        lines: content.split('\n').length,
      }, null, 2), false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to read spec: ${message}`);
    }
  }
}
