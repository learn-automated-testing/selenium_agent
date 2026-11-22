import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { expandHome, getOutputDir, getSpecsDir } from '../../utils/paths.js';
import { validateOutputPath } from '../../utils/sandbox.js';
import { checkPlanApproved, withPlanStatus } from '../../utils/plan-review.js';

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
Saved to <outputDir>/specs/<title-slug>.md as a draft: show it to the user, and generate tests from it only after they
approve it (planner_approve_plan).`;
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
    await fs.writeFile(specPath, withPlanStatus(content, 'draft'));

    return this.success(JSON.stringify({
      message: 'Spec saved as a draft',
      file: specPath,
      title,
      review: 'Show the spec to the user. Tests are generated from it only after they approve it (planner_approve_plan).',
    }, null, 2), false);
  }
}

// ============================================================================
// Generator Read Spec Tool
// ============================================================================

/**
 * Find a spec or test plan: an absolute path, a path in the output folder, or a name in specs/
 * (where planner_save_plan puts them). Shared by the generator tools that read plans.
 */
export async function findSpec(specFile: string): Promise<{ file: string; content: string }> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const expanded = expandHome(specFile);
  const named = path.join(getSpecsDir(), expanded.endsWith('.md') ? expanded : `${expanded}.md`);
  const candidates = path.isAbsolute(expanded) ? [expanded] : [path.join(getOutputDir(), expanded), named, path.resolve(expanded)];
  for (const candidate of candidates) {
    try {
      return { file: candidate, content: await fs.readFile(candidate, 'utf-8') };
    } catch {
      continue;
    }
  }
  throw new Error(`not found (looked in ${[...new Set(candidates)].join(', ')})`);
}

const readSpecSchema = z.object({
  specFile: z.string().describe('Spec or test plan to read: a path, or just its name in specs/ (e.g. "shopping-cart" or "shopping-cart.md")'),
  skipPlanReview: z.boolean().optional()
    .describe('Read a plan that is still a draft. Only when the user explicitly says to skip the plan review.'),
});

export class GeneratorReadSpecTool extends BaseTool {
  readonly name = 'generator_read_spec';
  readonly description = `Read a spec file from the specs directory.

Tests are only generated from an approved plan: a plan that is still a draft (Status: draft) is refused until the user
has reviewed and approved it (planner_approve_plan).`;
  readonly inputSchema = readSpecSchema;
  readonly category: ToolCategory = 'generator';

  async execute(_context: Context, params: unknown): Promise<ToolResult> {
    const { specFile, skipPlanReview } = this.parseParams(readSpecSchema, params);
    try {
      const { file, content } = await findSpec(specFile);
      const review = checkPlanApproved(content, file, skipPlanReview);
      if (!review.ok) return this.error(review.message!);
      return this.success(JSON.stringify({
        message: 'Spec loaded',
        file,
        planStatus: review.status ?? 'none',
        ...(review.message ? { review: review.message } : {}),
        content,
        lines: content.split('\n').length,
      }, null, 2), false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to read spec: ${message}`);
    }
  }
}
