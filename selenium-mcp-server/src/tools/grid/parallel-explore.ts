import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const AuthSchema = z.object({
  username: z.string(),
  password: z.string(),
  loginUrl: z.string().optional(),
  usernameSelector: z.string().optional(),
  passwordSelector: z.string().optional(),
  submitSelector: z.string().optional(),
}).optional();

const TargetSchema = z.object({
  url: z.string().describe('Starting URL for this exploration target'),
  label: z.string().optional().describe('Human-readable label for this target'),
  maxDepth: z.number().int().min(0).max(5).optional().default(2).describe('Maximum link-following depth'),
  maxPages: z.number().int().min(1).max(50).optional().default(20).describe('Maximum pages to discover'),
  auth: AuthSchema.describe('Authentication credentials for protected sections'),
});

const schema = z.object({
  baseUrl: z.string().describe('Base URL of the application (used to determine internal vs external links)'),
  targets: z.array(TargetSchema).min(1).max(10).describe('Exploration targets — each gets its own browser session'),
  browser: z.string().optional().default('chrome').describe('Browser to use for exploration sessions'),
  tags: z.array(z.string()).optional().default(['exploration']).describe('Tags applied to created sessions'),
});

export class ParallelExploreTool extends BaseTool {
  readonly name = 'parallel_explore';
  readonly description = 'Explore multiple sections of a web application in parallel using Selenium Grid. Each target gets its own browser session. Returns discovered pages, forms, links, and workflows.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'grid';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { baseUrl, targets, browser, tags } = this.parseParams(schema, params);
    const { coordinator } = await context.ensureGrid();

    const results = await coordinator.explore(baseUrl, targets, { browser, tags });

    const lines: string[] = [
      `Parallel exploration complete: ${results.length} target(s)`,
      '',
    ];

    for (const result of results) {
      const label = result.target.label || result.target.url;
      lines.push(`--- ${label} ---`);
      lines.push(`  Status: ${result.status}`);
      lines.push(`  Exploration ID: ${result.explorationId}`);
      lines.push(`  Session: ${result.sessionId}`);
      lines.push(`  Pages discovered: ${result.pages.length}`);
      lines.push(`  Workflows detected: ${result.workflows.length}`);
      lines.push(`  Duration: ${result.duration}ms`);

      if (result.error) {
        lines.push(`  Error: ${result.error}`);
      }

      if (result.pages.length > 0) {
        lines.push(`  Pages:`);
        for (const page of result.pages) {
          lines.push(`    [depth=${page.depth}] ${page.title} (${page.url}) — ${page.elements} elements, ${page.forms.length} forms`);
        }
      }

      if (result.workflows.length > 0) {
        lines.push(`  Workflows:`);
        for (const wf of result.workflows) {
          lines.push(`    - ${wf.name} (${wf.steps.length} steps)`);
        }
      }

      lines.push('');
    }

    return this.success(lines.join('\n'));
  }
}
