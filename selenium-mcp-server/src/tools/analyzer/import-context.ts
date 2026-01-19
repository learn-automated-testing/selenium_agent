import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  sourceType: z.enum(['file', 'text', 'url']).describe("Type of source: 'file' (local file), 'text' (inline text), 'url' (web page)"),
  source: z.string().describe('File path, inline text content, or URL depending on sourceType'),
  contextType: z.enum(['prd', 'architecture', 'api_spec', 'test_plan', 'general']).optional().default('general')
    .describe("Type of context: 'prd', 'architecture', 'api_spec', 'test_plan', 'general'"),
  description: z.string().optional().describe('Description of what this context contains')
});

export class AnalyzerImportContextTool extends BaseTool {
  readonly name = 'analyzer_import_context';
  readonly description = 'Import additional context from local files, inline text, or URLs to enrich the analysis';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { sourceType, source, contextType, description } = this.parseParams(schema, params);

    if (!context.analysisSession) {
      return this.error('No analysis session active. Run analyzer_setup first.');
    }

    let content: string;
    let sourceInfo: { type: string; path?: string; filename?: string; length?: number };

    if (sourceType === 'file') {
      const fs = await import('fs/promises');
      const path = await import('path');

      try {
        content = await fs.readFile(source, 'utf-8');
        sourceInfo = {
          type: 'file',
          path: path.resolve(source),
          filename: path.basename(source)
        };
      } catch (err) {
        return this.error(`File not found: ${source}`);
      }
    } else if (sourceType === 'text') {
      content = source;
      sourceInfo = {
        type: 'text',
        length: content.length
      };
    } else if (sourceType === 'url') {
      return this.error('URL import not yet implemented. Use "file" or "text" source types.');
    } else {
      return this.error(`Unknown sourceType: ${sourceType}`);
    }

    // Store the imported context
    const contextEntry = {
      source: sourceInfo,
      contextType: contextType || 'general',
      description,
      contentPreview: content.length > 500 ? content.slice(0, 500) + '...' : content,
      contentLength: content.length,
      importedAt: new Date().toISOString(),
      fullContent: content
    };

    context.analysisSession.importedContext.push(contextEntry);

    // Extract relevant information based on context type
    const extracted = this.extractRelevantInfo(content, contextType || 'general');

    const result = {
      message: 'Context imported successfully',
      source: sourceInfo,
      contextType: contextType || 'general',
      contentLength: content.length,
      extractedInfo: extracted,
      totalContexts: context.analysisSession.importedContext.length
    };

    return this.success(JSON.stringify(result, null, 2), false);
  }

  private extractRelevantInfo(content: string, contextType: string): Record<string, unknown> {
    const extracted: Record<string, unknown> = {};
    const contentLower = content.toLowerCase();

    if (contextType === 'prd') {
      if (contentLower.includes('user story') || contentLower.includes('as a user')) {
        extracted.hasUserStories = true;
      }
      if (contentLower.includes('requirement')) {
        extracted.hasRequirements = true;
      }
      if (contentLower.includes('acceptance criteria')) {
        extracted.hasAcceptanceCriteria = true;
      }
    } else if (contextType === 'architecture') {
      if (contentLower.includes('api')) {
        extracted.mentionsApi = true;
      }
      if (contentLower.includes('database')) {
        extracted.mentionsDatabase = true;
      }
      if (contentLower.includes('microservice')) {
        extracted.architectureType = 'microservices';
      }
      if (contentLower.includes('monolith')) {
        extracted.architectureType = 'monolith';
      }
    } else if (contextType === 'api_spec') {
      if (contentLower.includes('openapi') || contentLower.includes('swagger')) {
        extracted.specType = 'openapi';
      }
      if (contentLower.includes('graphql')) {
        extracted.specType = 'graphql';
      }
      // Count endpoints
      const endpointMatches = content.match(/\/(api|v\d|endpoint)/gi);
      if (endpointMatches) {
        extracted.estimatedEndpoints = endpointMatches.length;
      }
    } else if (contextType === 'test_plan') {
      extracted.hasExistingTests = true;
      if (contentLower.includes('selenium')) {
        extracted.usesSelenium = true;
      }
      if (contentLower.includes('cypress')) {
        extracted.usesCypress = true;
      }
      if (contentLower.includes('playwright')) {
        extracted.usesPlaywright = true;
      }
    }

    return extracted;
  }
}
