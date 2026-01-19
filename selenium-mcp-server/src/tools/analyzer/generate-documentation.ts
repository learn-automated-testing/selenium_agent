import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context, AnalysisSession } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  includeScreenshots: z.boolean().optional().default(true).describe('Include screenshots in the documentation'),
  includeRiskSummary: z.boolean().optional().default(true).describe('Include risk assessment summary'),
  outputFormat: z.enum(['markdown', 'html', 'both']).optional().default('both')
    .describe("Output format: 'markdown', 'html', or 'both' (recommended)"),
  outputFilename: z.string().optional().describe('Output filename without extension (defaults to product-discovery)')
});

export class AnalyzerGenerateDocumentationTool extends BaseTool {
  readonly name = 'analyzer_generate_documentation';
  readonly description = 'Generate a comprehensive product discovery document with screenshots - serves as input for the Planner agent';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { includeScreenshots, includeRiskSummary, outputFormat, outputFilename } = this.parseParams(schema, params);

    if (!context.analysisSession) {
      return this.error('No analysis session active. Run analyzer_setup first.');
    }

    const session = context.analysisSession;

    if (!session.discoveredFeatures || session.discoveredFeatures.length === 0) {
      return this.error('No features discovered. Run analyzer_scan_product first.');
    }

    const fs = await import('fs/promises');
    const path = await import('path');

    const outputDir = session.outputDir;
    const screenshotsDir = session.screenshotsDir;
    const baseFilename = outputFilename || 'product-discovery';

    const outputFiles: { format: string; path: string }[] = [];
    const format = outputFormat || 'both';

    // Generate Markdown if requested
    if (format === 'markdown' || format === 'both') {
      const markdownDoc = this.generateMarkdown(session, includeScreenshots ?? true, includeRiskSummary ?? true);
      const markdownPath = path.join(outputDir, `${baseFilename}.md`);
      await fs.writeFile(markdownPath, markdownDoc);
      outputFiles.push({ format: 'markdown', path: markdownPath });
    }

    // Generate HTML if requested
    if (format === 'html' || format === 'both') {
      const htmlDoc = this.generateHtml(session, includeScreenshots ?? true, includeRiskSummary ?? true);
      const htmlPath = path.join(outputDir, `${baseFilename}.html`);
      await fs.writeFile(htmlPath, htmlDoc);
      outputFiles.push({ format: 'html', path: htmlPath });
    }

    // Also save a summary YAML for the Planner
    const yaml = await import('yaml');
    const summaryPath = path.join(outputDir, 'discovery-summary.yaml');
    const summaryData = this.generateSummaryYaml(session);
    await fs.writeFile(summaryPath, yaml.stringify(summaryData));

    const primaryFile = outputFiles[0]?.path || path.join(outputDir, `${baseFilename}.md`);
    const htmlFile = outputFiles.find(f => f.format === 'html')?.path;

    const result = {
      message: 'Product discovery documentation generated successfully',
      outputFiles,
      summaryFile: summaryPath,
      screenshotsCount: session.screenshots.length,
      outputDirectory: outputDir,
      contents: {
        processesDocumented: Object.keys(session.processResults).length,
        pagesDocumented: session.discoveredPages.length,
        featuresDocumented: session.discoveredFeatures.length,
        screenshotsIncluded: includeScreenshots ? session.screenshots.length : 0
      },
      howToView: {
        html: htmlFile ? `Open in browser: ${htmlFile}` : null,
        markdown: 'Open in VS Code and press Cmd+Shift+V (Mac) or Ctrl+Shift+V (Windows)'
      },
      nextSteps: [
        htmlFile ? `View documentation: open ${htmlFile}` : `Review: ${primaryFile}`,
        'Use Planner agent with this documentation to create test plan',
        `Planner command: 'Create test plan using ${primaryFile}'`
      ]
    };

    return this.success(JSON.stringify(result, null, 2), false);
  }

  private generateMarkdown(session: AnalysisSession, includeScreenshots: boolean, includeRiskSummary: boolean): string {
    const lines: string[] = [];

    // Header
    lines.push(`# Product Discovery: ${session.productName}`);
    lines.push('');
    lines.push(`**URL:** ${session.url}`);
    lines.push(`**Domain:** ${session.domainType || 'Unknown'}`);
    lines.push(`**Analysis Date:** ${session.startedAt}`);
    lines.push('');

    // Table of Contents
    lines.push('## Table of Contents');
    lines.push('');
    lines.push('1. [Executive Summary](#executive-summary)');
    lines.push('2. [Process Flows](#process-flows)');
    lines.push('3. [Discovered Features](#discovered-features)');
    lines.push('4. [Page Inventory](#page-inventory)');
    if (includeRiskSummary && session.riskProfile) {
      lines.push('5. [Risk Assessment](#risk-assessment)');
    }
    lines.push('');

    // Executive Summary
    lines.push('---');
    lines.push('');
    lines.push('## Executive Summary');
    lines.push('');

    const processResults = session.processResults;
    const discoveredFeatures = session.discoveredFeatures;
    const discoveredPages = session.discoveredPages;
    const advisoryGaps = session.advisoryGaps;

    lines.push(`- **Processes Analyzed:** ${Object.keys(processResults).length}`);
    lines.push(`- **Pages Discovered:** ${discoveredPages.length}`);
    lines.push(`- **Features Found:** ${discoveredFeatures.length}`);
    lines.push(`- **Advisory Gaps:** ${advisoryGaps.length}`);
    lines.push('');

    // Homepage screenshot
    if (includeScreenshots) {
      const homepageScreenshot = session.screenshots.find(s => s.name === 'homepage');
      if (homepageScreenshot) {
        lines.push('### Homepage');
        lines.push('');
        lines.push(`![Homepage](screenshots/${homepageScreenshot.file})`);
        lines.push('');
      }
    }

    // Process Flows
    lines.push('---');
    lines.push('');
    lines.push('## Process Flows');
    lines.push('');
    lines.push('The following user journeys were analyzed:');
    lines.push('');

    for (const [processName, result] of Object.entries(processResults)) {
      lines.push(`### ${result.processDisplayName}`);
      lines.push('');

      if (result.description) {
        lines.push(`*${result.description}*`);
        lines.push('');
      }

      lines.push(`**Risk Level:** ${result.risk.toUpperCase()}`);
      lines.push(`**Status:** ${result.status}`);
      lines.push(`**Steps Completed:** ${result.stepsCompleted}/${result.stepsTotal}`);
      lines.push('');

      // Steps table
      if (result.steps.length > 0) {
        lines.push('| Step | Action | Status | URL |');
        lines.push('|------|--------|--------|-----|');
        for (const step of result.steps) {
          const statusIcon = !['not_found', 'error'].includes(step.status) ? '✅' : '❌';
          let url = step.url || '-';
          if (url.length > 40) {
            url = url.slice(0, 40) + '...';
          }
          lines.push(`| ${step.stepName} | ${step.stepAction} | ${statusIcon} ${step.status} | ${url} |`);
        }
        lines.push('');
      }

      // Screenshots for this process
      if (includeScreenshots && result.screenshots.length > 0) {
        lines.push('#### Screenshots');
        lines.push('');
        for (const screenshot of result.screenshots) {
          lines.push(`**${screenshot.step}**`);
          lines.push('');
          lines.push(`![${screenshot.step}](screenshots/${screenshot.file})`);
          lines.push('');
        }
      }
    }

    // Discovered Features
    lines.push('---');
    lines.push('');
    lines.push('## Discovered Features');
    lines.push('');

    if (discoveredFeatures.length > 0) {
      lines.push('| Feature | Type | URL |');
      lines.push('|---------|------|-----|');
      for (const feature of discoveredFeatures.slice(0, 50)) {
        let url = feature.url;
        if (url.length > 50) {
          url = url.slice(0, 50) + '...';
        }
        lines.push(`| ${feature.name} | ${feature.type} | ${url} |`);
      }
      if (discoveredFeatures.length > 50) {
        lines.push('');
        lines.push(`*... and ${discoveredFeatures.length - 50} more features*`);
      }
      lines.push('');
    }

    // Page Inventory
    lines.push('---');
    lines.push('');
    lines.push('## Page Inventory');
    lines.push('');

    if (discoveredPages.length > 0) {
      for (const page of discoveredPages.slice(0, 20)) {
        lines.push(`### ${page.title || 'Untitled'}`);
        lines.push('');
        lines.push(`**URL:** ${page.url}`);
        lines.push('');
        if (page.features.length > 0) {
          lines.push('**Features:**');
          for (const f of page.features.slice(0, 5)) {
            lines.push(`- ${f}`);
          }
          lines.push('');
        }
      }
    }

    // Risk Assessment
    if (includeRiskSummary && session.riskProfile) {
      lines.push('---');
      lines.push('');
      lines.push('## Risk Assessment');
      lines.push('');

      const summary = session.riskProfile.summary;
      lines.push(`- **Total Features:** ${summary.totalFeatures}`);
      lines.push(`- **Critical:** ${summary.criticalCount}`);
      lines.push(`- **High:** ${summary.highCount}`);
      lines.push(`- **Medium:** ${summary.mediumCount}`);
      lines.push(`- **Low:** ${summary.lowCount}`);
      lines.push('');

      // Critical features
      const criticalFeatures = session.riskProfile.features.filter(f => f.riskLevel === 'critical');
      if (criticalFeatures.length > 0) {
        lines.push('### Critical Risk Features');
        lines.push('');
        for (const f of criticalFeatures) {
          lines.push(`- **${f.name}** (Score: ${f.riskScore.toFixed(2)})`);
        }
        lines.push('');
      }

      // Gaps
      if (session.riskProfile.gaps.length > 0) {
        lines.push('### Identified Gaps');
        lines.push('');
        for (const gap of session.riskProfile.gaps) {
          lines.push(`- **${gap.expected}:** ${gap.status} - ${gap.recommendation}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private generateHtml(session: AnalysisSession, includeScreenshots: boolean, includeRiskSummary: boolean): string {
    const markdown = this.generateMarkdown(session, includeScreenshots, includeRiskSummary);

    // Simple markdown to HTML conversion
    let html = markdown
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" style="max-width: 100%;">')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/^---$/gm, '<hr>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\|.*\|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim());
        return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
      });

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Product Discovery: ${session.productName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1, h2, h3 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f5f5f5; }
    img { max-width: 100%; border: 1px solid #ddd; margin: 10px 0; }
    hr { border: none; border-top: 1px solid #ddd; margin: 30px 0; }
    .critical { color: #d32f2f; font-weight: bold; }
    .high { color: #f57c00; }
    .medium { color: #1976d2; }
    .low { color: #388e3c; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
  }

  private generateSummaryYaml(session: AnalysisSession): Record<string, unknown> {
    return {
      product: {
        name: session.productName,
        url: session.url,
        domain: session.domainType
      },
      analysis: {
        date: session.startedAt,
        riskAppetite: session.riskAppetite,
        compliance: session.compliance
      },
      summary: {
        processesAnalyzed: Object.keys(session.processResults).length,
        pagesDiscovered: session.discoveredPages.length,
        featuresFound: session.discoveredFeatures.length,
        screenshots: session.screenshots.length,
        gaps: session.advisoryGaps.length
      },
      criticalFeatures: session.riskProfile?.features
        .filter(f => f.riskLevel === 'critical')
        .map(f => f.name) || [],
      highRiskFeatures: session.riskProfile?.features
        .filter(f => f.riskLevel === 'high')
        .map(f => f.name) || [],
      recommendedTestPriority: session.riskProfile?.features
        .slice(0, 10)
        .map(f => ({ name: f.name, risk: f.riskLevel, score: f.riskScore })) || []
    };
  }
}
