import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({});

export class StopRecordingTool extends BaseTool {
  readonly name = 'stop_recording';
  readonly description = 'Stop recording browser actions. Returns full action log with element locators.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'recording';
  readonly annotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    const actions = context.actionHistory;
    const actionCount = actions.length;
    context.stopRecording();

    if (actionCount === 0) {
      return this.success('Recording stopped — no actions captured', false);
    }

    // Build detailed action log
    const actionLog = actions.map((action, i) => {
      const parts: string[] = [`${i + 1}. ${action.tool}`];

      // Include key params
      const relevantParams = Object.entries(action.params)
        .filter(([k]) => !['expectation'].includes(k))
        .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(', ');
      if (relevantParams) {
        parts.push(`   params: ${relevantParams}`);
      }

      // Include element locators
      if (action.elements) {
        for (const [ref, loc] of Object.entries(action.elements)) {
          const locParts: string[] = [];
          if (loc.id) locParts.push(`id="${loc.id}"`);
          if (loc.name) locParts.push(`name="${loc.name}"`);
          if (loc.text) locParts.push(`text="${loc.text.slice(0, 30)}"`);
          if (loc.ariaLabel) locParts.push(`aria-label="${loc.ariaLabel.slice(0, 30)}"`);
          parts.push(`   ${ref}: ${loc.tagName} [${locParts.join(', ')}]`);
        }
      }

      return parts.join('\n');
    });

    const framework = context.generatorFramework;
    const hint = framework ? `\nFramework: ${framework}` : '';

    const result = [
      `Recording stopped — captured ${actionCount} actions${hint}`,
      '',
      'Action Log:',
      actionLog.join('\n'),
      '',
      'To generate test code from this recording, use generator_write_test.',
    ].join('\n');

    return this.success(result, false);
  }
}
