#!/usr/bin/env node

import { runServer } from '../src/server.js';

runServer().catch(err => {
  console.error('Failed to start Selenium MCP server:', err);
  process.exit(1);
});
