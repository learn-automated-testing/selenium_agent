import { GridStatus, GridNodeInfo } from '../types.js';

export class GridClient {
  private gridUrl: string;

  constructor(gridUrl: string) {
    // Normalize: strip trailing slash
    this.gridUrl = gridUrl.replace(/\/+$/, '');
  }

  async getStatus(): Promise<GridStatus> {
    const response = await fetch(`${this.gridUrl}/status`);
    if (!response.ok) {
      throw new Error(`Grid status request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      value: {
        ready: boolean;
        message: string;
        nodes: Array<{
          id: string;
          uri: string;
          availability: string;
          maxSessions: number;
          slots: Array<{
            stereotype: { browserName?: string; browserVersion?: string; platformName?: string };
            session: { sessionId: string } | null;
          }>;
        }>;
      };
    };

    const nodes: GridNodeInfo[] = (data.value.nodes || []).map(node => {
      const browsers = new Map<string, { browserName: string; browserVersion: string; platformName: string }>();
      let activeSessions = 0;

      for (const slot of node.slots || []) {
        if (slot.session) activeSessions++;
        const key = `${slot.stereotype.browserName || 'unknown'}-${slot.stereotype.browserVersion || ''}`;
        if (!browsers.has(key)) {
          browsers.set(key, {
            browserName: slot.stereotype.browserName || 'unknown',
            browserVersion: slot.stereotype.browserVersion || '',
            platformName: slot.stereotype.platformName || '',
          });
        }
      }

      return {
        id: node.id,
        uri: node.uri,
        status: node.availability,
        maxSessions: node.maxSessions,
        activeSessions,
        browsers: Array.from(browsers.values()),
      };
    });

    const totalSlots = nodes.reduce((sum, n) => sum + n.maxSessions, 0);
    const usedSlots = nodes.reduce((sum, n) => sum + n.activeSessions, 0);

    return {
      ready: data.value.ready,
      message: data.value.message,
      nodes,
      totalSlots,
      usedSlots,
      availableSlots: totalSlots - usedSlots,
    };
  }
}
