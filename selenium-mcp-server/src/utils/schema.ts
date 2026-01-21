import { z } from 'zod';

/**
 * Convert Zod schema to JSON Schema for MCP tool definitions
 */
export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const zodValue = value as z.ZodType;
      properties[key] = zodTypeToJsonSchema(zodValue);

      if (!(zodValue instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined
    };
  }

  return zodTypeToJsonSchema(schema);
}

function zodTypeToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const description = schema.description;

  if (schema instanceof z.ZodString) {
    return { type: 'string', description };
  }

  if (schema instanceof z.ZodNumber) {
    return { type: 'number', description };
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean', description };
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodTypeToJsonSchema(schema.element),
      description
    };
  }

  if (schema instanceof z.ZodOptional) {
    return zodTypeToJsonSchema(schema.unwrap());
  }

  if (schema instanceof z.ZodDefault) {
    const inner = zodTypeToJsonSchema(schema._def.innerType);
    return { ...inner, default: schema._def.defaultValue() };
  }

  if (schema instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: schema.options,
      description
    };
  }

  if (schema instanceof z.ZodLiteral) {
    return {
      type: typeof schema.value,
      const: schema.value,
      description
    };
  }

  if (schema instanceof z.ZodUnion) {
    return {
      oneOf: schema.options.map((opt: z.ZodType) => zodTypeToJsonSchema(opt)),
      description
    };
  }

  if (schema instanceof z.ZodObject) {
    return zodToJsonSchema(schema);
  }

  // Fallback for unknown types
  return { type: 'string', description };
}
