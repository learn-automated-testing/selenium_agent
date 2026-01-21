import { z } from 'zod';
import { Context } from '../context.js';
import { ToolDefinition, ToolResult } from '../types.js';

export abstract class BaseTool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly inputSchema: z.ZodType;

  get definition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema
    };
  }

  abstract execute(context: Context, params: unknown): Promise<ToolResult>;

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
}
