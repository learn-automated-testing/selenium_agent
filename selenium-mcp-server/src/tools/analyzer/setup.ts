import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { getProductDiscoveryDir } from '../../utils/paths.js';

const schema = z.object({
  url: z.string().describe('Base URL of the product to analyze'),
  productName: z.string().describe('Name of the product'),
  riskAppetite: z.enum(['startup-mvp', 'standard', 'regulated']).optional().default('standard')
    .describe('Risk appetite: startup-mvp (minimal), standard (balanced), regulated (maximum)'),
  compliance: z.array(z.string()).optional().describe("Compliance requirements (e.g., ['PCI-DSS', 'GDPR', 'HIPAA'])"),
  criticalFlows: z.array(z.string()).optional().describe("User-identified critical business flows (e.g., ['checkout', 'payment', 'registration'])"),
  outputDir: z.string().optional().describe('Override output directory (defaults to SELENIUM_MCP_OUTPUT_DIR env var or cwd)')
});

export class AnalyzerSetupTool extends BaseTool {
  readonly name = 'analyzer_setup';
  readonly description = 'Initialize regression analysis session with product URL and business context';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'analyzer';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { url, productName, riskAppetite, compliance, criticalFlows, outputDir: outputDirParam } =
      this.parseParams(schema, params);

    const driver = await context.ensureBrowser();
    await driver.get(url);
    await context.captureSnapshot();

    const fs = await import('fs/promises');
    const path = await import('path');

    const productSlug = productName.toLowerCase().replace(/ /g, '-').replace(/_/g, '-');

    // Output directory: parameter > env var > cwd
    const baseOutputDir = outputDirParam || getProductDiscoveryDir(productSlug);
    const screenshotsDir = path.join(baseOutputDir, 'screenshots');

    await fs.mkdir(screenshotsDir, { recursive: true });

    // Initialize analysis session
    context.analysisSession = {
      productName,
      productSlug,
      url,
      compliance: compliance || [],
      riskAppetite: riskAppetite ?? 'standard',
      criticalFlows: criticalFlows || [],
      discoveredFeatures: [],
      discoveredPages: [],
      importedContext: [],
      riskProfile: null,
      startedAt: new Date().toISOString(),
      outputDir: baseOutputDir,
      screenshotsDir,
      screenshots: [],
      processDocumentation: [],
      processResults: {},
      advisoryGaps: []
    };

    const result = {
      status: 'ready',
      message: `Analysis session initialized for '${productName}'`,
      url,
      riskAppetite: riskAppetite ?? 'standard',
      compliance: compliance || [],
      criticalFlows: criticalFlows || [],
      outputDirectory: baseOutputDir,
      nextSteps: [
        'Use analyzer_import_context to provide PRD, user stories, or scope instructions',
        'Use analyzer_scan_product to explore and discover features',
        'Use analyzer_build_risk_profile to generate the risk profile'
      ]
    };

    return this.success(JSON.stringify(result, null, 2), true);
  }
}
