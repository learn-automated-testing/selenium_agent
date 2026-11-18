/**
 * Tool groups ("toolsets") let users load only the tools they need.
 *
 * Every tool definition is sent to the model on every request, so a smaller
 * set saves context and helps the model pick the right tool. Some MCP clients
 * also cap how many tools they load.
 *
 *   SELENIUM_MCP_TOOLSETS=core                 browsing and verification only
 *   SELENIUM_MCP_TOOLSETS=core,generator,healer
 *   SELENIUM_MCP_TOOLSETS=all                  (default) everything
 */

export const TOOLSET_NAMES = [
  'core',
  'recording',
  'planner',
  'generator',
  'healer',
  'analyzer',
  'grid',
] as const;

export type ToolsetName = (typeof TOOLSET_NAMES)[number];

/** Toolsets that need another toolset to be useful. */
const TOOLSET_DEPENDENCIES: Partial<Record<ToolsetName, ToolsetName[]>> = {
  // The generator turns a recorded session into a test.
  generator: ['recording'],
};

export interface ToolsetSelection {
  enabled: Set<ToolsetName>;
  unknown: string[];
}

/**
 * Parse a comma-separated toolset list. Unset, empty or "all" enables every
 * toolset, so existing setups keep working unchanged. "core" is always enabled.
 */
export function parseToolsets(raw: string | undefined): ToolsetSelection {
  const requested = (raw ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  if (requested.length === 0 || requested.includes('all')) {
    return { enabled: new Set(TOOLSET_NAMES), unknown: [] };
  }

  const enabled = new Set<ToolsetName>(['core']);
  const unknown: string[] = [];
  for (const name of requested) {
    if ((TOOLSET_NAMES as readonly string[]).includes(name)) {
      const toolset = name as ToolsetName;
      enabled.add(toolset);
      for (const dep of TOOLSET_DEPENDENCIES[toolset] ?? []) enabled.add(dep);
    } else {
      unknown.push(name);
    }
  }
  return { enabled, unknown };
}
