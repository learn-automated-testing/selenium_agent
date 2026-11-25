import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

export const LOOPS = ['claude', 'vscode', 'copilot', 'cursor'] as const;
export type Loop = (typeof LOOPS)[number];

export const DEFAULT_SERVER_NAME = 'selenium-ai-agent';

/** One agent: instructions plus the tools it may use (plain server tool names, or "search"/"edit"). */
export interface AgentSpec {
  name: string;
  description: string;
  model?: string;
  color?: string;
  tools: string[];
  instructions: string;
}

export interface WrittenFile {
  path: string;
  content: string;
}

/** The agent templates ship in the package's agents/ folder (dist/src/init-agents.js → ../../agents). */
export function agentsSourceDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'agents');
}

export function parseAgent(text: string): AgentSpec {
  // Windows checkouts (git autocrlf) and editors may use CRLF line endings.
  const match = text.replace(/\r\n?/g, '\n').match(/^\uFEFF?---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error('Agent file has no front matter');
  const header = YAML.parse(match[1]) as Partial<AgentSpec>;
  if (!header.name || !header.description || !Array.isArray(header.tools)) {
    throw new Error('Agent front matter needs name, description and tools');
  }
  return {
    name: header.name,
    description: header.description,
    model: header.model,
    color: header.color,
    tools: header.tools,
    instructions: match[2].trim() + '\n',
  };
}

export function loadAgents(dir = agentsSourceDir()): AgentSpec[] {
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.agent.md'))
    .sort()
    .map(f => parseAgent(fs.readFileSync(path.join(dir, f), 'utf8')));
}

const CLAUDE_BUILTINS: Record<string, string[]> = {
  search: ['Glob', 'Grep', 'Read', 'LS'],
  edit: ['Edit', 'MultiEdit', 'Write'],
};

const VSCODE_BUILTINS: Record<string, string[]> = {
  search: ['search/listDirectory', 'search/fileSearch', 'search/textSearch', 'search/readFile'],
  edit: ['edit/createFile', 'edit/createDirectory', 'edit/editFiles'],
};

function frontMatter(header: Record<string, unknown>): string {
  const clean = Object.fromEntries(Object.entries(header).filter(([, v]) => v !== undefined));
  return `---\n${YAML.stringify(clean, { lineWidth: 100000 })}---\n`;
}

/** The agent file for one client, with tool names in that client's format. */
export function renderAgent(agent: AgentSpec, loop: Loop, server: string): WrittenFile {
  switch (loop) {
    case 'claude': {
      const tools = agent.tools.flatMap(t => CLAUDE_BUILTINS[t] ?? [`mcp__${server}__${t}`]);
      return {
        path: `.claude/agents/${agent.name}.md`,
        content:
          frontMatter({ name: agent.name, description: agent.description, tools: tools.join(', '), model: agent.model, color: agent.color }) +
          '\n' + agent.instructions,
      };
    }
    case 'vscode': {
      const tools = agent.tools.flatMap(t => VSCODE_BUILTINS[t] ?? [`${server}/${t}`]);
      return {
        path: `.github/chatmodes/${agent.name}.chatmode.md`,
        content: `---\ndescription: ${agent.description}\ntools: [${tools.map(t => `'${t}'`).join(', ')}]\n---\n\n` + agent.instructions,
      };
    }
    case 'copilot': {
      const tools = agent.tools.map(t => (CLAUDE_BUILTINS[t] ? t : `${server}/${t}`));
      return {
        path: `.github/agents/${agent.name}.agent.md`,
        content:
          frontMatter({
            name: agent.name,
            description: agent.description,
            tools,
            'mcp-servers': { [server]: { type: 'stdio', ...MCP_SERVER_ENTRY, tools: ['*'] } },
          }) +
          '\n' + agent.instructions,
      };
    }
    case 'cursor': {
      // Cursor has no separate agent files: the instructions become a rule you attach with @name.
      const toolList = agent.tools.filter(t => !CLAUDE_BUILTINS[t]).map(t => `\`${t}\``).join(', ');
      return {
        path: `.cursor/rules/${agent.name}.mdc`,
        content:
          `---\ndescription: ${agent.description}\nglobs:\nalwaysApply: false\n---\n\n` +
          `Use the tools of the \`${server}\` MCP server: ${toolList}.\n\n` + agent.instructions,
      };
    }
  }
}

export const MCP_SERVER_ENTRY = { command: 'npx', args: ['-y', 'selenium-ai-agent@latest'] };

/** Where each client keeps its project MCP configuration, and the key that holds the servers. */
const MCP_CONFIG: Record<Loop, { file: string; key: string } | null> = {
  claude: { file: '.mcp.json', key: 'mcpServers' },
  vscode: { file: '.vscode/mcp.json', key: 'servers' },
  copilot: null, // the agent file itself carries the server
  cursor: { file: '.cursor/mcp.json', key: 'mcpServers' },
};

function readJson(file: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** The name this project already uses for the Selenium AI Agent server, if any. */
export function detectServerName(cwd: string): string | undefined {
  for (const { file, key } of Object.values(MCP_CONFIG).filter(Boolean) as Array<{ file: string; key: string }>) {
    const servers = readJson(path.join(cwd, file))?.[key] as Record<string, { command?: string; args?: string[] }> | undefined;
    for (const [name, entry] of Object.entries(servers ?? {})) {
      const line = [entry?.command ?? '', ...(entry?.args ?? [])].join(' ');
      if (/selenium-ai-agent|selenium-mcp/.test(line)) return name;
    }
  }
  return undefined;
}

export interface InitAgentsOptions {
  loop: Loop;
  server?: string;
  cwd?: string;
  agentsDir?: string;
}

export interface InitAgentsResult {
  server: string;
  written: string[];
  mcpConfig?: string;
}

/**
 * Write the planner, generator, healer and analyzer agents where the client looks for them,
 * with tool names in its format, and register the MCP server in the project when missing.
 * Run again after updating selenium-ai-agent to pick up new tools and instructions.
 */
export function initAgents(opts: InitAgentsOptions): InitAgentsResult {
  const cwd = opts.cwd ?? process.cwd();
  const server = opts.server ?? detectServerName(cwd) ?? DEFAULT_SERVER_NAME;
  const written: string[] = [];

  for (const agent of loadAgents(opts.agentsDir)) {
    const file = renderAgent(agent, opts.loop, server);
    const target = path.join(cwd, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
    written.push(file.path);
  }

  let mcpConfig: string | undefined;
  const config = MCP_CONFIG[opts.loop];
  if (config) {
    const target = path.join(cwd, config.file);
    const json = readJson(target) ?? {};
    const servers = (json[config.key] ?? {}) as Record<string, unknown>;
    if (!servers[server]) {
      servers[server] = opts.loop === 'vscode' ? { type: 'stdio', ...MCP_SERVER_ENTRY } : { ...MCP_SERVER_ENTRY };
      json[config.key] = servers;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, JSON.stringify(json, null, 2) + '\n');
      mcpConfig = config.file;
    }
  }

  return { server, written, ...(mcpConfig ? { mcpConfig } : {}) };
}
