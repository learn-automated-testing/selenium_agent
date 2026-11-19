#!/usr/bin/env node

import { runServer, runHttpServer } from '../src/server.js';
import { getOutputDir } from '../src/utils/paths.js';

// Parse CLI flags and set corresponding env vars
const args = process.argv.slice(2);

if (args[0] === 'install') {
  const { handleInstall } = await import('./install.js');
  handleInstall(args.slice(1));
  process.exit(0);
}

if (args[0] === 'init-agents') {
  const { initAgents, LOOPS } = await import('../src/init-agents.js');
  const value = (flag: string) => args.find(a => a.startsWith(`--${flag}=`))?.slice(flag.length + 3);
  const loop = value('loop') ?? 'claude';
  if (!(LOOPS as readonly string[]).includes(loop)) {
    console.error(`Unknown --loop=${loop}. Use one of: ${LOOPS.join(', ')}`);
    process.exit(1);
  }
  const result = initAgents({ loop: loop as (typeof LOOPS)[number], server: value('server') });
  console.log(`Selenium AI Agent: test agents for ${loop} (MCP server "${result.server}")\n`);
  for (const file of result.written) console.log(`  wrote ${file}`);
  if (result.mcpConfig) console.log(`  added the "${result.server}" server to ${result.mcpConfig}`);
  console.log('\nAsk your AI assistant to use the selenium-test-planner, -generator or -healer agent.');
  console.log('Run this again after updating selenium-ai-agent to pick up new tools and instructions.');
  process.exit(0);
}

if (args[0] === 'doctor') {
  const { runDoctor, formatDoctorReport } = await import('../src/doctor.js');
  const report = await runDoctor();
  console.log(formatDoctorReport(report));
  process.exit(report.ok ? 0 : 1);
}

let transport = 'stdio';
let port = 3000;

for (const arg of args) {
  switch (arg) {
    case '--allow-unrestricted-file-access':
      process.env.SELENIUM_MCP_UNRESTRICTED_FILES = 'true';
      break;
    case '--save-trace':
      process.env.SELENIUM_MCP_SAVE_TRACE = 'true';
      break;
    case '--stealth':
      process.env.SELENIUM_STEALTH = 'true';
      break;
    case '--headless':
      process.env.SELENIUM_HEADLESS = 'true';
      break;
    case '--verbose-attributes':
      process.env.SELENIUM_MCP_VERBOSE_ATTRIBUTES = 'true';
      break;
    case '--output-mode=file':
      process.env.SELENIUM_MCP_OUTPUT_MODE = 'file';
      break;
    case '--output-mode=stdout':
      process.env.SELENIUM_MCP_OUTPUT_MODE = 'stdout';
      break;
    default:
      if (arg.startsWith('--output-dir=')) {
        process.env.SELENIUM_MCP_OUTPUT_DIR = arg.slice('--output-dir='.length);
      } else if (arg.startsWith('--toolsets=')) {
        process.env.SELENIUM_MCP_TOOLSETS = arg.slice('--toolsets='.length);
      } else if (arg.startsWith('--grid-url=')) {
        process.env.SELENIUM_GRID_URL = arg.slice('--grid-url='.length);
      } else if (arg.startsWith('--transport=')) {
        transport = arg.slice('--transport='.length);
      } else if (arg.startsWith('--port=')) {
        port = parseInt(arg.slice('--port='.length), 10);
      }
      break;
  }
}

if (transport === 'http') {
  runHttpServer(port).catch(err => {
    console.error('Failed to start Selenium MCP HTTP server:', err);
    process.exit(1);
  });
} else {
  console.error(`[selenium-mcp] Output folder for test plans, tests and reports: ${getOutputDir()}`);
  runServer().catch(err => {
    console.error('Failed to start Selenium MCP server:', err);
    process.exit(1);
  });
}
