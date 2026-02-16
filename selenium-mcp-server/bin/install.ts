import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir, platform } from 'os';

interface TargetConfig {
  name: string;
  getConfigPath: () => string;
}

const TARGETS: Record<string, TargetConfig> = {
  'claude-desktop': {
    name: 'Claude Desktop',
    getConfigPath: () => {
      if (platform() === 'win32') {
        return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
      }
      return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    },
  },
  cursor: {
    name: 'Cursor',
    getConfigPath: () => join(homedir(), '.cursor', 'mcp.json'),
  },
  windsurf: {
    name: 'Windsurf',
    getConfigPath: () => join(homedir(), '.codeium', 'windsurf', 'mcp_config.json'),
  },
};

const SERVER_ENTRY = {
  command: 'npx',
  args: ['selenium-ai-agent'],
};

function readJsonFile(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) {
    return {};
  }

  const raw = readFileSync(filePath, 'utf-8').trim();
  if (raw === '') {
    return {};
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Could not parse ${filePath} — please fix the JSON syntax and try again.`
    );
  }
}

function installToTarget(targetKey: string): void {
  const target = TARGETS[targetKey];
  if (!target) {
    console.error(`Unknown target: ${targetKey}`);
    printInstallHelp();
    process.exit(1);
  }

  const configPath = target.getConfigPath();
  console.log(`Installing to ${target.name}...`);
  console.log(`  Config: ${configPath}`);

  const config = readJsonFile(configPath);

  const mcpServers = (config.mcpServers ?? {}) as Record<string, unknown>;

  if (mcpServers['selenium-mcp']) {
    console.log('\n  Already configured — no changes made.');
    return;
  }

  mcpServers['selenium-mcp'] = SERVER_ENTRY;
  config.mcpServers = mcpServers;

  const dir = dirname(configPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  console.log('\n  Done! Restart your MCP client to pick up the new server.');
}

function printInstallHelp(): void {
  console.log(`
Usage: npx selenium-ai-agent install <target>

Available targets:
  claude-desktop   Claude Desktop app
  cursor           Cursor editor
  windsurf         Windsurf editor

Example:
  npx selenium-ai-agent install claude-desktop
`);
}

export function handleInstall(args: string[]): void {
  const target = args[0];
  if (!target) {
    printInstallHelp();
    return;
  }
  installToTarget(target);
}
