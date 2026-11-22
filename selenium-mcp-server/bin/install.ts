import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir, platform } from 'os';
import { writeProjectRules, RULES_TARGETS, type RulesTarget } from '../src/project-rules.js';
import { detectProjectRoot, defaultOutputDir, expandHome } from '../src/utils/paths.js';
import { resolve as resolvePath } from 'path';

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
  junie: {
    name: 'Junie (IntelliJ IDEA, PyCharm and other JetBrains IDEs)',
    getConfigPath: () => join(homedir(), '.junie', 'mcp', 'mcp.json'),
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

interface ServerEntry { command: string; args: string[]; env?: Record<string, string> }

/**
 * Where plans, tests and reports go. These clients start the server outside any project (Claude Desktop in "/"),
 * so the project is written into the config: --output-dir=..., else the project install runs in, else none
 * (then ~/selenium-ai-agent).
 */
export function outputDirFor(args: string[], cwd = process.cwd()): { dir: string | null; explicit: boolean } {
  const given = args.find(a => a.startsWith('--output-dir='))?.slice('--output-dir='.length);
  if (given) return { dir: resolvePath(expandHome(given)), explicit: true };
  return { dir: detectProjectRoot(cwd), explicit: false };
}

function installToTarget(targetKey: string, args: string[] = []): void {
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
  const { dir, explicit } = outputDirFor(args);
  const existing = mcpServers['selenium-mcp'] as ServerEntry | undefined;
  const current = existing?.env?.SELENIUM_MCP_OUTPUT_DIR;

  if (existing) {
    if (!dir || current === dir) {
      console.log('\n  Already configured — no changes made.');
      console.log(`  Plans, tests and reports go to: ${current ? expandHome(current) : defaultOutputDir()}`);
      return;
    }
    if (current && !explicit) {
      console.log('\n  Already configured — no changes made.');
      console.log(`  Plans, tests and reports go to: ${expandHome(current)}`);
      console.log(`  To use this project instead: npx selenium-ai-agent install ${targetKey} --output-dir=${dir}`);
      return;
    }
    existing.env = { ...(existing.env ?? {}), SELENIUM_MCP_OUTPUT_DIR: dir };
  } else {
    mcpServers['selenium-mcp'] = { ...SERVER_ENTRY, ...(dir ? { env: { SELENIUM_MCP_OUTPUT_DIR: dir } } : {}) };
  }
  config.mcpServers = mcpServers;

  const configDir = dirname(configPath);
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  console.log(`\n  Plans, tests and reports go to: ${dir ?? defaultOutputDir()}` +
    (dir ? (explicit ? '' : ' (the project you ran this in)') : ' (no project found here; run install in your project folder to use it)'));
  console.log(`  ${existing ? 'Updated' : 'Done'}! Restart your MCP client to pick up the ${existing ? 'change' : 'new server'}.`);
}

function printInstallHelp(): void {
  console.log(`
Usage: npx selenium-ai-agent install <target> [--output-dir=<project>] [--with-rules[=claude,cursor,copilot,windsurf,agents]] [--framework=<f>]

Run it in your project folder: plans, tests and reports then go to that project (or name it with --output-dir).

Available targets:
  claude-desktop   Claude Desktop app
  cursor           Cursor editor
  windsurf         Windsurf editor
  junie            Junie in IntelliJ IDEA, PyCharm and other JetBrains IDEs (~/.junie/mcp/mcp.json)

--with-rules also writes Selenium's rules for AI agents (https://www.selenium.dev/documentation/ai_agents/)
into this project's instruction file: .cursor/rules/selenium.mdc for Cursor, .windsurf/rules/selenium.md for
Windsurf, Junie's guidelines for Junie, or the files you name (claude = CLAUDE.md, copilot =
.github/copilot-instructions.md, agents = AGENTS.md, junie = .junie/AGENTS.md or the guidelines Junie already reads).
The framework (for the language notes) is detected from the project, or set with --framework=selenium-java-maven, ...

Examples:
  npx selenium-ai-agent install claude-desktop
  npx selenium-ai-agent install cursor --with-rules
`);
}

/** Instruction file for each install target that has one in the project. */
const RULES_FOR_TARGET: Record<string, RulesTarget | undefined> = {
  'claude-desktop': undefined,
  cursor: 'cursor',
  windsurf: 'windsurf',
  junie: 'junie',
};

/** Parse "--with-rules" / "--with-rules=claude,agents" into rules targets (null when the flag is absent). */
export function parseWithRules(args: string[], defaultTarget?: RulesTarget): RulesTarget[] | null {
  const flag = args.find(a => a === '--with-rules' || a.startsWith('--with-rules='));
  if (!flag) return null;
  const listed = flag.includes('=') ? flag.split('=')[1].split(',').map(t => t.trim()).filter(Boolean) : [];
  const unknown = listed.filter(t => !(t in RULES_TARGETS));
  if (unknown.length) {
    throw new Error(`Unknown --with-rules target: ${unknown.join(', ')}. Use: ${Object.keys(RULES_TARGETS).join(', ')}`);
  }
  if (listed.length) return listed as RulesTarget[];
  return defaultTarget ? [defaultTarget] : [];
}

export function printRulesResult(result: ReturnType<typeof writeProjectRules>): void {
  const version = result.version ? `, version ${result.version}` : '';
  console.log(`\n  Rules for AI agents (${result.framework}${version}):`);
  for (const w of result.written) console.log(`    ${w.action} ${w.file}`);
}

export function handleInstall(args: string[]): void {
  const target = args[0];
  if (!target || target.startsWith('--')) {
    printInstallHelp();
    return;
  }
  installToTarget(target, args.slice(1));
  let targets: RulesTarget[] | null;
  try {
    targets = parseWithRules(args.slice(1), RULES_FOR_TARGET[target]);
  } catch (err) {
    console.error(`\n  ${(err as Error).message}`);
    process.exit(1);
  }
  if (targets === null) return;
  if (targets.length === 0) {
    console.log(`\n  ${TARGETS[target]?.name ?? target} has no project instruction file, so no rules file was written.` +
      '\n  The server gives the rules to the generator itself; to add them for other tools use --with-rules=claude,agents.');
    return;
  }
  const framework = args.find(a => a.startsWith('--framework='))?.slice('--framework='.length);
  printRulesResult(writeProjectRules({ targets, framework }));
}
