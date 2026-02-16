#!/usr/bin/env node

import { runServer, runHttpServer } from '../src/server.js';

// Parse CLI flags and set corresponding env vars
const args = process.argv.slice(2);

if (args[0] === 'install') {
  const { handleInstall } = await import('./install.js');
  handleInstall(args.slice(1));
  process.exit(0);
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
    case '--output-mode=file':
      process.env.SELENIUM_MCP_OUTPUT_MODE = 'file';
      break;
    case '--output-mode=stdout':
      process.env.SELENIUM_MCP_OUTPUT_MODE = 'stdout';
      break;
    default:
      if (arg.startsWith('--output-dir=')) {
        process.env.SELENIUM_MCP_OUTPUT_DIR = arg.slice('--output-dir='.length);
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
  runServer().catch(err => {
    console.error('Failed to start Selenium MCP server:', err);
    process.exit(1);
  });
}
