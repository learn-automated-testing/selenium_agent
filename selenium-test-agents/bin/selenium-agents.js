#!/usr/bin/env node

/**
 * Selenium Test Agents CLI
 *
 * Initialize AI test agents in your project:
 *   npx selenium-agents init
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AGENTS_SOURCE = join(__dirname, '..', 'agents');
const AGENTS_TARGET = '.agents';

function printHelp() {
  console.log(`
Selenium Test Agents - AI-powered test automation

Usage:
  npx selenium-agents <command>

Commands:
  init        Initialize agents in current directory
  list        List available agents
  help        Show this help message

Examples:
  npx selenium-agents init      # Creates .agents/ folder with agent definitions
  npx selenium-agents list      # Shows available agents

After init, use agents in your AI coding tool (Cursor, Claude, etc.):
  - selenium-test-planner: Creates test plans
  - selenium-test-generator: Generates test code
  - selenium-test-healer: Fixes failing tests
`);
}

function listAgents() {
  console.log('\nAvailable Selenium Test Agents:\n');

  const agents = [
    {
      name: 'selenium-test-planner',
      description: 'Explores your app and creates comprehensive test plans',
      file: 'selenium-test-planner.agent.md'
    },
    {
      name: 'selenium-test-generator',
      description: 'Generates test code from approved test plans',
      file: 'selenium-test-generator.agent.md'
    },
    {
      name: 'selenium-test-healer',
      description: 'Debugs and fixes failing tests automatically',
      file: 'selenium-test-healer.agent.md'
    }
  ];

  agents.forEach(agent => {
    console.log(`  ${agent.name}`);
    console.log(`    ${agent.description}`);
    console.log(`    File: ${agent.file}\n`);
  });
}

function initAgents() {
  console.log('\nInitializing Selenium Test Agents...\n');

  // Check if agents source exists
  if (!existsSync(AGENTS_SOURCE)) {
    console.error('Error: Agent files not found in package.');
    console.error('Please reinstall: npm install selenium-test-agents');
    process.exit(1);
  }

  // Create .agents directory if it doesn't exist
  if (!existsSync(AGENTS_TARGET)) {
    mkdirSync(AGENTS_TARGET, { recursive: true });
    console.log(`Created ${AGENTS_TARGET}/ directory`);
  } else {
    console.log(`${AGENTS_TARGET}/ directory already exists`);
  }

  // Copy agent files
  const agentFiles = readdirSync(AGENTS_SOURCE).filter(f => f.endsWith('.agent.md'));

  agentFiles.forEach(file => {
    const source = join(AGENTS_SOURCE, file);
    const target = join(AGENTS_TARGET, file);

    if (existsSync(target)) {
      console.log(`  Skipped: ${file} (already exists)`);
    } else {
      copyFileSync(source, target);
      console.log(`  Copied: ${file}`);
    }
  });

  console.log(`
Agents initialized successfully!

Your agents are now in .agents/ folder:
  - selenium-test-planner.agent.md
  - selenium-test-generator.agent.md
  - selenium-test-healer.agent.md

Next steps:
1. Make sure selenium-agent MCP server is configured in your AI tool
2. Ask your AI assistant to use the planner agent to create test plans
3. Use the generator agent to create test code from plans
4. Use the healer agent to fix any failing tests

Example prompts:
  "Use selenium-test-planner to create a test plan for the login page"
  "Generate pytest tests from the test plan using selenium-test-generator"
  "Fix the failing tests using selenium-test-healer"
`);
}

// Main
const command = process.argv[2];

switch (command) {
  case 'init':
    initAgents();
    break;
  case 'list':
    listAgents();
    break;
  case 'help':
  case '--help':
  case '-h':
    printHelp();
    break;
  default:
    if (command) {
      console.error(`Unknown command: ${command}\n`);
    }
    printHelp();
    process.exit(command ? 1 : 0);
}
