import { describe, it } from 'mocha';
import { expect } from 'chai';
import { z } from 'zod';
import { zodToJsonSchema } from './schema.js';
import { BatchExecuteTool } from '../tools/batch/batch-execute.js';

describe('zodToJsonSchema', () => {
  it('describes unknown values as any JSON, not as a string', () => {
    const json = zodToJsonSchema(z.object({ args: z.record(z.string(), z.unknown()) }));
    const args = (json.properties as Record<string, Record<string, unknown>>).args;
    expect(args.type).to.equal('object');
    expect(args.additionalProperties).to.deep.equal({});
  });

  it('lets batch_execute pass lists and numbers to tools', () => {
    const json = zodToJsonSchema(new BatchExecuteTool().inputSchema as z.ZodType) as {
      properties: { steps: { items: { properties: { arguments: { additionalProperties: unknown } } } } };
    };
    expect(json.properties.steps.items.properties.arguments.additionalProperties).to.deep.equal({});
  });
});
