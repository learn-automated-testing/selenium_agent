import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context, FeatureAssessment, CoverageRecommendation, RiskGap, DiscoveredFeature } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  includeRecommendations: z.boolean().optional().default(true)
    .describe('Include coverage recommendations in the profile'),
  includePipelineConfig: z.boolean().optional().default(false)
    .describe('Include CI/CD pipeline configuration suggestions')
});

export class AnalyzerBuildRiskProfileTool extends BaseTool {
  readonly name = 'analyzer_build_risk_profile';
  readonly description = 'Build comprehensive risk profile from discovered features and context';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'analyzer';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { includeRecommendations, includePipelineConfig } = this.parseParams(schema, params);

    if (!context.analysisSession) {
      return this.error('No analysis session active. Run analyzer_setup first.');
    }

    const session = context.analysisSession;

    if (!session.discoveredFeatures || session.discoveredFeatures.length === 0) {
      return this.error('No features discovered. Run analyzer_scan_product first.');
    }

    const discoveredFeatures = session.discoveredFeatures;
    const criticalFlows = session.criticalFlows;
    const compliance = session.compliance;
    const riskAppetite = session.riskAppetite;
    const importedContext = session.importedContext;

    // Build feature risk assessments
    const featureAssessments: FeatureAssessment[] = [];

    for (const feature of discoveredFeatures) {
      const assessment = this.assessFeatureRisk(
        feature,
        criticalFlows,
        compliance,
        riskAppetite,
        importedContext
      );
      featureAssessments.push(assessment);
    }

    // Sort by risk score
    featureAssessments.sort((a, b) => b.riskScore - a.riskScore);

    // Build coverage recommendations
    const coverageRecommendations: CoverageRecommendation[] = includeRecommendations
      ? this.buildCoverageRecommendations(featureAssessments, riskAppetite)
      : [];

    // Build pipeline config if requested
    let pipelineConfig = undefined;
    if (includePipelineConfig) {
      pipelineConfig = this.buildPipelineConfig(featureAssessments);
    }

    // Identify gaps from imported context
    const gaps = this.identifyGaps(featureAssessments, importedContext);

    // Build the complete profile
    const riskProfile = {
      product: {
        name: session.productName,
        url: session.url,
        domain: 'auto-detected',
        analyzedDate: new Date().toISOString()
      },
      businessContext: {
        type: 'context-driven',
        compliance,
        riskAppetite,
        criticalFlows
      },
      features: featureAssessments,
      coverageRecommendations,
      gaps,
      summary: {
        totalFeatures: featureAssessments.length,
        criticalCount: featureAssessments.filter(f => f.riskLevel === 'critical').length,
        highCount: featureAssessments.filter(f => f.riskLevel === 'high').length,
        mediumCount: featureAssessments.filter(f => f.riskLevel === 'medium').length,
        lowCount: featureAssessments.filter(f => f.riskLevel === 'low').length
      },
      pipelineConfig
    };

    // Store in session
    session.riskProfile = riskProfile;

    const result = {
      message: 'Risk profile built successfully',
      summary: riskProfile.summary,
      criticalFeatures: featureAssessments.filter(f => f.riskLevel === 'critical').map(f => f.name),
      highFeatures: featureAssessments.filter(f => f.riskLevel === 'high').map(f => f.name),
      skipRecommendations: featureAssessments.filter(f => f.skipRecommendation).map(f => f.name),
      gapsIdentified: gaps.length,
      nextStep: 'Review the profile and use analyzer_save_profile to save it'
    };

    return this.success(JSON.stringify(result, null, 2), false);
  }

  private assessFeatureRisk(
    feature: DiscoveredFeature,
    criticalFlows: string[],
    compliance: string[],
    riskAppetite: string,
    importedContext: { fullContent: string; contextType: string }[]
  ): FeatureAssessment {
    const featureName = feature.name;
    const featureNameLower = featureName.toLowerCase();

    // Default scores
    let revenueImpact = 0.3;
    let userImpact = 0.3;
    let frequency = 0.5;
    let complexity = 0.3;
    let complianceScore = 0.0;

    // Check imported context for mentions of this feature
    const contextMentionCount = importedContext.reduce((count, ctx) => {
      const content = ctx.fullContent.toLowerCase();
      return count + (content.includes(featureNameLower) ? 1 : 0);
    }, 0);

    // Features mentioned in imported context are likely more important
    if (contextMentionCount > 0) {
      revenueImpact = Math.max(revenueImpact, 0.5 + contextMentionCount * 0.1);
      userImpact = Math.max(userImpact, 0.5 + contextMentionCount * 0.1);
    }

    // Boost if in critical flows
    if (criticalFlows.some(flow => featureNameLower.includes(flow.toLowerCase()))) {
      revenueImpact = Math.max(revenueImpact, 0.8);
      userImpact = Math.max(userImpact, 0.8);
    }

    // Check if compliance requirements mention this feature
    if (compliance.length > 0) {
      const complianceContext = importedContext
        .filter(ctx => ctx.contextType === 'prd' || ctx.contextType === 'general')
        .map(ctx => ctx.fullContent.toLowerCase())
        .join(' ');
      if (compliance.some(c => complianceContext.includes(c.toLowerCase()) && complianceContext.includes(featureNameLower))) {
        complianceScore = 0.8;
      }
    }

    // Detect high-risk patterns in feature name
    const highRiskPatterns = ['payment', 'checkout', 'login', 'auth', 'password', 'account', 'transaction', 'invoice', 'order', 'billing'];
    if (highRiskPatterns.some(p => featureNameLower.includes(p))) {
      revenueImpact = Math.max(revenueImpact, 0.7);
      userImpact = Math.max(userImpact, 0.7);
    }

    // Detect medium-risk patterns
    const mediumRiskPatterns = ['form', 'submit', 'create', 'delete', 'edit', 'update', 'upload', 'download', 'export', 'import'];
    if (mediumRiskPatterns.some(p => featureNameLower.includes(p))) {
      revenueImpact = Math.max(revenueImpact, 0.5);
      complexity = Math.max(complexity, 0.5);
    }

    // Calculate final score
    const riskScore =
      revenueImpact * 0.30 +
      userImpact * 0.25 +
      frequency * 0.15 +
      complexity * 0.15 +
      complianceScore * 0.15;

    // Classify
    let riskLevel: string;
    if (riskScore >= 0.8) {
      riskLevel = 'critical';
    } else if (riskScore >= 0.6) {
      riskLevel = 'high';
    } else if (riskScore >= 0.4) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    // Adjust for risk appetite
    if (riskAppetite === 'startup-mvp' && riskLevel === 'medium') {
      riskLevel = 'low';
    } else if (riskAppetite === 'regulated' && riskLevel === 'medium') {
      riskLevel = 'high';
    }

    // Determine if skip recommendation applies
    const skipRecommendation = riskAppetite === 'startup-mvp' && riskLevel === 'low';

    return {
      name: featureName,
      riskLevel,
      riskScore,
      skipRecommendation,
      factors: {
        revenueImpact,
        userImpact,
        frequency,
        complexity,
        complianceScore
      }
    };
  }

  private buildCoverageRecommendations(
    assessments: FeatureAssessment[],
    riskAppetite: string
  ): CoverageRecommendation[] {
    const recommendations: CoverageRecommendation[] = [];

    for (const assessment of assessments) {
      let coverage: string;
      let reason: string;

      if (assessment.riskLevel === 'critical') {
        coverage = 'comprehensive';
        reason = 'Critical feature requires full test coverage including edge cases and error scenarios';
      } else if (assessment.riskLevel === 'high') {
        coverage = 'thorough';
        reason = 'High-risk feature needs thorough testing of main flows and error handling';
      } else if (assessment.riskLevel === 'medium') {
        if (riskAppetite === 'regulated') {
          coverage = 'thorough';
          reason = 'Regulated environment requires thorough testing even for medium-risk features';
        } else {
          coverage = 'standard';
          reason = 'Standard test coverage for happy path and common error cases';
        }
      } else {
        if (riskAppetite === 'startup-mvp') {
          coverage = 'minimal';
          reason = 'Low priority in MVP context - smoke test only';
        } else {
          coverage = 'basic';
          reason = 'Basic coverage for happy path';
        }
      }

      recommendations.push({
        feature: assessment.name,
        coverage,
        reason
      });
    }

    return recommendations;
  }

  private buildPipelineConfig(
    assessments: FeatureAssessment[]
  ): { stages: { name: string; tests: string[]; parallel?: boolean }[] } {
    const stages: { name: string; tests: string[]; parallel?: boolean }[] = [];

    // Critical tests run first
    const criticalTests = assessments.filter(a => a.riskLevel === 'critical').map(a => a.name);
    if (criticalTests.length > 0) {
      stages.push({
        name: 'critical',
        tests: criticalTests,
        parallel: false
      });
    }

    // High-priority tests
    const highTests = assessments.filter(a => a.riskLevel === 'high').map(a => a.name);
    if (highTests.length > 0) {
      stages.push({
        name: 'high_priority',
        tests: highTests,
        parallel: true
      });
    }

    // Standard tests
    const mediumTests = assessments.filter(a => a.riskLevel === 'medium').map(a => a.name);
    if (mediumTests.length > 0) {
      stages.push({
        name: 'standard',
        tests: mediumTests,
        parallel: true
      });
    }

    // Low priority (optional)
    const lowTests = assessments.filter(a => a.riskLevel === 'low').map(a => a.name);
    if (lowTests.length > 0) {
      stages.push({
        name: 'low_priority',
        tests: lowTests,
        parallel: true
      });
    }

    return { stages };
  }

  private identifyGaps(
    assessments: FeatureAssessment[],
    importedContext: { fullContent: string; contextType: string }[]
  ): RiskGap[] {
    const gaps: RiskGap[] = [];

    if (importedContext.length === 0) return gaps;

    const assessmentNames = assessments.map(a => a.name.toLowerCase());

    // Extract keywords from imported context that might indicate expected features
    const criticalKeywords = ['critical', 'must have', 'required', 'essential', 'mandatory'];
    const contextContent = importedContext.map(ctx => ctx.fullContent).join('\n');

    // Check critical flows mentioned in context but not found in discovered features
    const lines = contextContent.split('\n');
    for (const line of lines) {
      const lineLower = line.toLowerCase();
      const isCritical = criticalKeywords.some(kw => lineLower.includes(kw));
      if (!isCritical) continue;

      // Look for feature-like terms in critical lines
      const featurePatterns = /(?:feature|flow|process|workflow|function):\s*(.+?)(?:\.|$)/gi;
      let match;
      while ((match = featurePatterns.exec(line)) !== null) {
        const expectedFeature = match[1].trim();
        const found = assessmentNames.some(name =>
          name.includes(expectedFeature.toLowerCase()) ||
          expectedFeature.toLowerCase().includes(name)
        );

        if (!found) {
          gaps.push({
            expected: expectedFeature,
            status: 'not_found',
            recommendation: `Expected critical feature "${expectedFeature}" (from imported context) was not discovered. Verify it exists or update scan parameters.`
          });
        }
      }
    }

    return gaps;
  }
}
