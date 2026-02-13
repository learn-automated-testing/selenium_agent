import { getOutputDir } from '../utils/paths.js';

export interface TraceEntry {
  type: 'tool_call' | 'tool_result' | 'event';
  timestamp: number;
  tool?: string;
  params?: Record<string, unknown>;
  result?: { content: string; isError?: boolean };
  event?: { category: string; data: unknown };
}

/**
 * Records tool calls, results, and BiDi events as structured trace entries.
 * Saves to <outputDir>/traces/session-<timestamp>.json on demand.
 */
export class SessionTracer {
  private entries: TraceEntry[] = [];
  private startedAt = Date.now();

  recordToolCall(tool: string, params: Record<string, unknown>): void {
    this.entries.push({
      type: 'tool_call',
      timestamp: Date.now(),
      tool,
      params,
    });
  }

  recordToolResult(tool: string, result: { content: string; isError?: boolean }): void {
    this.entries.push({
      type: 'tool_result',
      timestamp: Date.now(),
      tool,
      result: {
        content: result.content.slice(0, 2000),
        isError: result.isError,
      },
    });
  }

  recordEvent(category: string, data: unknown): void {
    this.entries.push({
      type: 'event',
      timestamp: Date.now(),
      event: { category, data },
    });
  }

  async save(): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const tracesDir = path.join(getOutputDir(), 'traces');
    await fs.mkdir(tracesDir, { recursive: true });

    const filename = `session-${new Date(this.startedAt).toISOString().replace(/[:.]/g, '-')}.json`;
    const tracePath = path.join(tracesDir, filename);

    const trace = {
      version: 1,
      startedAt: new Date(this.startedAt).toISOString(),
      endedAt: new Date().toISOString(),
      duration: Date.now() - this.startedAt,
      entries: this.entries,
      totalEntries: this.entries.length,
    };

    await fs.writeFile(tracePath, JSON.stringify(trace, null, 2));
    return tracePath;
  }

  get entryCount(): number {
    return this.entries.length;
  }
}
