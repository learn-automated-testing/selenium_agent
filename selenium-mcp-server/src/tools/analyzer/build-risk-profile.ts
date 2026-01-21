import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context, FeatureAssessment, CoverageRecommendation, RiskGap, DomainTemplate, DiscoveredFeature } from '../../context.js';
import { ToolResult } from '../../types.js';

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

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { includeRecommendations, includePipelineConfig } = this.parseParams(schema, params);

    if (!context.analysisSession) {
      return this.error('No analysis session active. Run analyzer_setup first.');
    }

    const session = context.analysisSession;

    if (!session.discoveredFeatures || session.discoveredFeatures.length === 0) {
      return this.error('No features discovered. Run analyzer_scan_product first.');
    }

    const domainTemplate = session.domainTemplate;
    const discoveredFeatures = session.discoveredFeatures;
    const criticalFlows = session.criticalFlows;
    const compliance = session.compliance;
    const riskAppetite = session.riskAppetite;

    // Build feature risk assessments
    const featureAssessments: FeatureAssessment[] = [];

    for (const feature of discoveredFeatures) {
      const assessment = this.assessFeatureRisk(
        feature,
        domainTemplate,
        criticalFlows,
        compliance,
        riskAppetite
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
      pipelineConfig = this.buildPipelineConfig(featureAssessments, domainTemplate);
    }

    // Identify gaps
    const gaps = this.identifyGaps(featureAssessments, domainTemplate);

    // Build the complete profile
    const riskProfile = {
      product: {
        name: session.productName,
        url: session.url,
        domain: session.domainType || 'unknown',
        analyzedDate: new Date().toISOString()
      },
      businessContext: {
        type: session.domainType || 'unknown',
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
    domainTemplate: DomainTemplate | null,
    criticalFlows: string[],
    compliance: string[],
    riskAppetite: string
  ): FeatureAssessment {
    const featureName = feature.name;
    const featureNameLower = featureName.toLowerCase();

    // Default scores
    let revenueImpact = 0.3;
    let userImpact = 0.3;
    let frequency = 0.5;
    let complexity = 0.3;
    let complianceScore = 0.0;

    // Check domain template
    if (domainTemplate) {
      const templateFeatures = domainTemplate.features || {};
      for (const [tplName, tplInfo] of Object.entries(templateFeatures)) {
        if (tplName.toLowerCase().includes(featureNameLower) || featureNameLower.includes(tplName.toLowerCase())) {
          const riskLevel = tplInfo.risk || 'medium';

          if (riskLevel === 'critical') {
            revenueImpact = 0.9;
            userImpact = 0.9;
          } else if (riskLevel === 'high') {
            revenueImpact = 0.7;
            userImpact = 0.7;
          } else if (riskLevel === 'medium') {
            revenueImpact = 0.4;
            userImpact = 0.5;
          } else {
            revenueImpact = 0.2;
            userImpact = 0.2;
          }

          // Check compliance
          if (tplInfo.compliance) {
            if (tplInfo.compliance.some(c => compliance.includes(c))) {
              complianceScore = 0.8;
            }
          }

          break;
        }
      }
    }

    // Boost if in critical flows
    if (criticalFlows.some(flow => featureNameLower.includes(flow.toLowerCase()))) {
      revenueImpact = Math.max(revenueImpact, 0.8);
      userImpact = Math.max(userImpact, 0.8);
    }

    // Detect high-risk patterns in feature name
    const highRiskPatterns = ['payment', 'checkout', 'login', 'auth', 'password', 'account', 'transaction'];
    if (highRiskPatterns.some(p => featureNameLower.includes(p))) {
      revenueImpact = Math.max(revenueImpact, 0.7);
      userImpact = Math.max(userImpact, 0.7);
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
    assessments: FeatureAssessment[],
    domainTemplate: DomainTemplate | null
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
    domainTemplate: DomainTemplate | null
  ): RiskGap[] {
    const gaps: RiskGap[] = [];

    if (!domainTemplate) return gaps;

    // Check for expected features not found
    const templateFeatures = domainTemplate.features || {};
    const assessmentNames = assessments.map(a => a.name.toLowerCase());

    for (const [featureName, featureInfo] of Object.entries(templateFeatures)) {
      const found = assessmentNames.some(name =>
        name.includes(featureName.toLowerCase()) ||
        featureName.toLowerCase().includes(name)
      );

      if (!found && featureInfo.risk && ['critical', 'high'].includes(featureInfo.risk)) {
        gaps.push({
          expected: featureName,
          status: 'not_found',
          recommendation: `Expected ${featureInfo.risk}-risk feature "${featureName}" was not discovered. Verify it exists or update scan parameters.`
        });
      }
    }

    // Check for expected processes not completed
    const templateProcesses = domainTemplate.processes || {};
    for (const [processName, processInfo] of Object.entries(templateProcesses)) {
      if (processInfo.risk === 'critical') {
        const found = assessmentNames.some(name =>
          name.includes(processName.toLowerCase())
        );

        if (!found) {
          gaps.push({
            expected: `Process: ${processName}`,
            status: 'not_verified',
            recommendation: `Critical process "${processName}" could not be fully verified. Manual testing recommended.`
          });
        }
      }
    }

    return gaps;
  }
}
