import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  filename: z.string().optional().describe('Output filename (default: product-name-risk-profile.yaml)'),
  outputFormat: z.enum(['yaml', 'json']).optional().default('yaml').describe("Output format: 'yaml' or 'json'")
});

export class AnalyzerSaveProfileTool extends BaseTool {
  readonly name = 'analyzer_save_profile';
  readonly description = 'Save the completed risk profile to a file';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { filename, outputFormat } = this.parseParams(schema, params);

    if (!context.analysisSession) {
      return this.error('No analysis session active. Run analyzer_setup first.');
    }

    const session = context.analysisSession;
    const riskProfile = session.riskProfile;

    if (!riskProfile) {
      return this.error('No risk profile built. Run analyzer_build_risk_profile first.');
    }

    const fs = await import('fs/promises');
    const path = await import('path');

    // Determine filename
    const format = outputFormat || 'yaml';
    const ext = format === 'yaml' ? 'yaml' : 'json';
    const outputFilename = filename || `${session.productSlug}-risk-profile.${ext}`;

    // Create output directory
    const outputDir = path.join(process.cwd(), 'risk-profiles');
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, outputFilename);

    // Save the profile
    if (format === 'yaml') {
      const yaml = await import('yaml');
      await fs.writeFile(outputPath, yaml.stringify(riskProfile));
    } else {
      await fs.writeFile(outputPath, JSON.stringify(riskProfile, null, 2));
    }

    const summary = riskProfile.summary;

    const result = {
      message: 'Risk profile saved successfully',
      file: outputPath,
      format,
      summary,
      nextSteps: [
        'Review the risk profile for accuracy',
        'Adjust risk levels if needed',
        `Use Planner agent with: 'Plan regression tests using ${outputPath}'`
      ]
    };

    return this.success(JSON.stringify(result, null, 2), false);
  }
}
