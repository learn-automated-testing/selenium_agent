import { z } from 'zod';

/**
 * Convert Zod schema to JSON Schema for MCP tool definitions
 */
export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  // .transform()/.pipe() produce a ZodPipe: describe its input side.
  // (.refine()/.superRefine() keep the original schema type in zod 4.)
  if (schema instanceof z.ZodPipe) {
    return zodToJsonSchema(schema.in as z.ZodType);
  }

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
      items: zodTypeToJsonSchema(schema.element as z.ZodType),
      description
    };
  }

  if (schema instanceof z.ZodOptional) {
    return zodTypeToJsonSchema(schema.unwrap() as z.ZodType);
  }

  if (schema instanceof z.ZodDefault) {
    const inner = zodTypeToJsonSchema(schema.unwrap() as z.ZodType);
    return { ...inner, default: schema.def.defaultValue };
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
      oneOf: schema.options.map(opt => zodTypeToJsonSchema(opt as z.ZodType)),
      description
    };
  }

  if (schema instanceof z.ZodRecord) {
    return { type: 'object', additionalProperties: zodTypeToJsonSchema(schema.valueType as z.ZodType), description };
  }

  if (schema instanceof z.ZodObject) {
    return zodToJsonSchema(schema);
  }

  if (schema instanceof z.ZodNullable) {
    const inner = zodTypeToJsonSchema(schema.unwrap() as z.ZodType);
    return { ...inner, nullable: true, description };
  }

  // Fallback for unknown types
  return { type: 'string', description };
}
