import { z } from 'zod';
import { Context } from '../context.js';
import { ToolDefinition, ToolResult, ToolCategory, Expectation, DEFAULT_EXPECTATIONS } from '../types.js';

export const ExpectationSchema = z.object({
  includeSnapshot: z.boolean().optional().describe('Whether to include page snapshot in response'),
  includeConsole: z.boolean().optional().describe('Whether to include console logs in response'),
  includeNetwork: z.boolean().optional().describe('Whether to include network request summary in response'),
  snapshotOptions: z.object({
    selector: z.string().optional().describe('CSS selector to scope element discovery'),
    maxLength: z.number().optional().describe('Max characters for snapshot text'),
  }).optional().describe('Options for snapshot capture'),
  consoleOptions: z.object({
    levels: z.array(z.enum(['error', 'warn', 'info', 'log'])).optional().describe('Console log levels to include'),
    maxMessages: z.number().optional().describe('Maximum number of console messages'),
  }).optional().describe('Options for console log retrieval'),
  diffOptions: z.object({
    enabled: z.boolean().optional().describe('Enable diff mode to return only changes'),
    format: z.enum(['minimal', 'unified']).optional().describe('Diff output format'),
  }).optional().describe('Options for diff-based snapshot responses'),
}).optional().describe('Control what data is included in the response');

/**
 * MCP tool annotations — hints that help clients decide whether to
 * auto-approve tool calls without user confirmation.
 */
export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export abstract class BaseTool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly inputSchema: z.ZodType;
  readonly category: ToolCategory = 'browser';

  /**
   * Override in subclasses to provide MCP annotations.
   * Defaults are derived from the category in getAnnotations().
   */
  readonly annotations?: ToolAnnotations;

  /**
   * Returns MCP annotations for this tool.
   * If not explicitly set, derives sensible defaults from the category.
   */
  getAnnotations(): ToolAnnotations {
    if (this.annotations) return this.annotations;

    // Default annotations by category
    switch (this.category) {
      case 'verification':
        return { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
      case 'page':
        return { readOnlyHint: true, destructiveHint: false, openWorldHint: true };
      case 'recording':
        return { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
      case 'navigation':
      case 'interaction':
      case 'input':
      case 'wait':
        return { readOnlyHint: false, destructiveHint: false, openWorldHint: true };
      case 'browser':
        return { readOnlyHint: false, destructiveHint: false, openWorldHint: true };
      case 'session':
        return { readOnlyHint: false, destructiveHint: true, openWorldHint: false };
      case 'agent':
      case 'generator':
      case 'analyzer':
        return { readOnlyHint: false, destructiveHint: false, openWorldHint: true };
      case 'grid':
        return { readOnlyHint: false, destructiveHint: false, openWorldHint: true };
      case 'batch':
        return { readOnlyHint: false, destructiveHint: false, openWorldHint: true };
      default:
        return { readOnlyHint: false, destructiveHint: false, openWorldHint: true };
    }
  }

  get definition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema
    };
  }

  abstract execute(context: Context, params: unknown): Promise<ToolResult>;

  resolveExpectation(params: Record<string, unknown>): Expectation {
    const categoryDefaults = DEFAULT_EXPECTATIONS[this.category];
    const userExpectation = params?.expectation as Expectation | undefined;

    if (!userExpectation) {
      return { ...categoryDefaults };
    }

    return {
      includeSnapshot: userExpectation.includeSnapshot ?? categoryDefaults.includeSnapshot,
      includeConsole: userExpectation.includeConsole ?? categoryDefaults.includeConsole,
      includeNetwork: userExpectation.includeNetwork ?? categoryDefaults.includeNetwork,
      snapshotOptions: userExpectation.snapshotOptions,
      consoleOptions: userExpectation.consoleOptions,
      diffOptions: userExpectation.diffOptions,
    };
  }

  protected parseParams<T>(schema: z.ZodType<T>, params: unknown): T {
    return schema.parse(params);
  }

  protected success(content: string, captureSnapshot = false): ToolResult {
    return { content, captureSnapshot };
  }

  protected error(message: string): ToolResult {
    return { content: message, isError: true };
  }

  protected successWithImage(content: string, base64Image: string): ToolResult {
    return { content, base64Image, captureSnapshot: false };
  }

  protected successWithResource(content: string, data: string, mimeType: string): ToolResult {
    return { content, base64Resource: { data, mimeType }, captureSnapshot: false };
  }
}
