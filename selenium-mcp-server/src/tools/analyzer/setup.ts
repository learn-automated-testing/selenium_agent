import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context, DomainTemplate } from '../../context.js';
import { ToolResult } from '../../types.js';

// Domain template utilities
async function getDomainTemplatesDir(): Promise<string> {
  const path = await import('path');
  return path.join(process.cwd(), 'domain_templates');
}

async function loadDomainTemplate(domain: string): Promise<DomainTemplate | null> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const yaml = await import('yaml');

  const templatesDir = await getDomainTemplatesDir();
  const templatePath = path.join(templatesDir, `${domain}.yaml`);

  try {
    const content = await fs.readFile(templatePath, 'utf-8');
    return yaml.parse(content) as DomainTemplate;
  } catch {
    return null;
  }
}

async function listAvailableDomains(): Promise<string[]> {
  const fs = await import('fs/promises');
  const path = await import('path');

  const templatesDir = await getDomainTemplatesDir();

  try {
    const files = await fs.readdir(templatesDir);
    return files
      .filter(f => f.endsWith('.yaml'))
      .map(f => f.replace('.yaml', ''));
  } catch {
    return [];
  }
}

const schema = z.object({
  url: z.string().describe('Base URL of the product to analyze'),
  productName: z.string().describe('Name of the product'),
  domainType: z.string().optional().describe('Domain type (e-commerce, saas, banking, healthcare). If not provided, will attempt auto-detection.'),
  domainTemplateChoice: z.enum(['use_detected', 'use_specified', 'scan_all', 'ask']).optional().default('ask')
    .describe("How to handle domain template: 'use_detected', 'use_specified', 'scan_all', or 'ask' (returns options for user)"),
  compliance: z.array(z.string()).optional().describe("Compliance requirements (e.g., ['PCI-DSS', 'GDPR', 'HIPAA'])"),
  riskAppetite: z.enum(['startup-mvp', 'standard', 'regulated']).optional().default('standard')
    .describe('Risk appetite: startup-mvp (minimal), standard (balanced), regulated (maximum)'),
  criticalFlows: z.array(z.string()).optional().describe("User-identified critical business flows (e.g., ['checkout', 'payment', 'registration'])")
});

export class AnalyzerSetupTool extends BaseTool {
  readonly name = 'analyzer_setup';
  readonly description = 'Initialize regression analysis session with product URL and business context';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { url, productName, domainType, domainTemplateChoice, compliance, riskAppetite, criticalFlows } =
      this.parseParams(schema, params);

    const driver = await context.ensureBrowser();
    await driver.get(url);
    await context.captureSnapshot();

    // Auto-detect domain if not specified
    let detectedDomain: string | null = null;
    if (!domainType) {
      detectedDomain = await this.autoDetectDomain(driver);
    }

    const effectiveDomain = domainType || detectedDomain;
    const availableDomains = await listAvailableDomains();

    // If asking for user confirmation
    const choice = domainTemplateChoice || 'ask';
    if (choice === 'ask') {
      let domainInfo = null;
      if (effectiveDomain) {
        const template = await loadDomainTemplate(effectiveDomain);
        if (template) {
          const processes = template.processes || {};
          domainInfo = {
            name: effectiveDomain,
            description: template.domain?.description || '',
            processes: Object.entries(processes).map(([pid, p]) => ({
              name: p.name || pid,
              risk: p.risk || 'medium',
              stepsCount: (p.steps || []).length
            })),
            focusAreas: Object.entries(processes)
              .filter(([_, p]) => ['critical', 'high'].includes(p.risk || ''))
              .map(([pid, p]) => p.name || pid)
          };
        }
      }

      const result = {
        status: 'awaiting_confirmation',
        message: 'Domain template detected. Please confirm how to proceed.',
        url,
        productName,
        detectedDomain: effectiveDomain,
        domainAutoDetected: detectedDomain !== null,
        domainInfo,
        availableTemplates: availableDomains,
        options: {
          use_detected: effectiveDomain ? `Use '${effectiveDomain}' template - focuses on domain-specific processes` : null,
          scan_all: 'Scan all sections equally - no domain focus, explores everything',
          use_specified: 'Choose a different template from: ' + availableDomains.join(', ')
        },
        recommendation: effectiveDomain ? `Use '${effectiveDomain}' template` : 'Scan all (no domain detected)',
        nextStep: "Call analyzer_setup again with domainTemplateChoice='use_detected' or 'scan_all'"
      };

      return this.success(JSON.stringify(result, null, 2), true);
    }

    // Proceed with chosen option
    const fs = await import('fs/promises');
    const path = await import('path');

    const productSlug = productName.toLowerCase().replace(/ /g, '-').replace(/_/g, '-');
    const outputDir = path.join(process.cwd(), 'product-discovery', productSlug);
    const screenshotsDir = path.join(outputDir, 'screenshots');

    await fs.mkdir(screenshotsDir, { recursive: true });

    // Determine which domain template to use
    let useDomainTemplate = false;
    let domainTemplate: DomainTemplate | null = null;
    let domainToUse: string | null = null;

    if (choice === 'use_detected') {
      domainToUse = effectiveDomain;
      useDomainTemplate = true;
    } else if (choice === 'use_specified') {
      domainToUse = domainType || null;
      useDomainTemplate = true;
    } else if (choice === 'scan_all') {
      useDomainTemplate = false;
      domainToUse = null;
    }

    if (useDomainTemplate && domainToUse) {
      domainTemplate = await loadDomainTemplate(domainToUse);
    }

    // Initialize analysis session
    context.analysisSession = {
      productName,
      productSlug,
      url,
      domainType: domainToUse,
      useDomainTemplate,
      domainTemplate,
      compliance: compliance || [],
      riskAppetite: riskAppetite || 'standard',
      criticalFlows: criticalFlows || [],
      discoveredFeatures: [],
      discoveredPages: [],
      importedContext: [],
      riskProfile: null,
      startedAt: new Date().toISOString(),
      outputDir,
      screenshotsDir,
      screenshots: [],
      processDocumentation: [],
      processResults: {},
      advisoryGaps: []
    };

    // Build response
    let focusInfo;
    if (useDomainTemplate && domainTemplate) {
      const processes = domainTemplate.processes || {};
      focusInfo = {
        mode: 'domain_focused',
        template: domainToUse,
        willFocusOn: Object.entries(processes).map(([pid, p]) =>
          `${p.name || pid} (${(p.risk || 'medium').toUpperCase()})`
        ),
        criticalProcesses: Object.entries(processes)
          .filter(([_, p]) => p.risk === 'critical')
          .map(([pid]) => pid)
      };
    } else {
      focusInfo = {
        mode: 'scan_all',
        template: null,
        willFocusOn: ['All navigation sections equally'],
        note: 'No domain template - will discover and assess all features'
      };
    }

    const result = {
      status: 'ready',
      message: `Analysis session initialized for '${productName}'`,
      url,
      analysisMode: focusInfo,
      riskAppetite: riskAppetite || 'standard',
      compliance: compliance || [],
      criticalFlows: criticalFlows || [],
      outputDirectory: outputDir,
      nextSteps: [
        'Use analyzer_import_context to import additional documents (optional)',
        'Use analyzer_scan_product to explore and discover features',
        'Use analyzer_build_risk_profile to generate the risk profile'
      ]
    };

    return this.success(JSON.stringify(result, null, 2), true);
  }

  private async autoDetectDomain(driver: any): Promise<string | null> {
    try {
      const pageSource = (await driver.getPageSource()).toLowerCase();
      const url = (await driver.getCurrentUrl()).toLowerCase();

      // E-commerce detection
      const ecommerceIndicators = [
        'add to cart', 'shopping cart', 'checkout', 'buy now',
        'product', 'price', 'shop', 'store', '/cart', '/checkout'
      ];
      const ecommerceScore = ecommerceIndicators.filter(ind =>
        pageSource.includes(ind) || url.includes(ind)
      ).length;

      if (ecommerceScore >= 3) {
        return 'e-commerce';
      }

      // SaaS detection
      const saasIndicators = [
        'dashboard', 'subscription', 'plan', 'pricing',
        'sign up', 'login', 'workspace', 'team'
      ];
      const saasScore = saasIndicators.filter(ind =>
        pageSource.includes(ind) || url.includes(ind)
      ).length;

      if (saasScore >= 3) {
        return 'saas';
      }

      // Banking detection
      const bankingIndicators = [
        'account', 'balance', 'transfer', 'payment',
        'transaction', 'bank', 'finance'
      ];
      const bankingScore = bankingIndicators.filter(ind =>
        pageSource.includes(ind) || url.includes(ind)
      ).length;

      if (bankingScore >= 3) {
        return 'banking';
      }

      return null;
    } catch {
      return null;
    }
  }
}
