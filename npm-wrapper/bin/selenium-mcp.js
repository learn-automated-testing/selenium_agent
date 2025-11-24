#!/usr/bin/env node

/**
 * Selenium MCP Server Launcher
 *
 * This script launches the Python-based Selenium MCP server.
 * It automatically detects the Python installation and starts the server.
 */

import { spawn } from 'child_process';
import { platform } from 'os';

// Determine the Python command based on platform
function getPythonCommand() {
  const isWindows = platform() === 'win32';

  // Try common Python commands in order of preference
  const pythonCommands = isWindows
    ? ['python', 'python3', 'py']
    : ['python3.13', 'python3.12', 'python3.11', 'python3.10', 'python3', 'python'];

  return pythonCommands;
}

// Check if Python command exists
async function checkPythonCommand(cmd) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, ['--version'], { stdio: 'pipe' });
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
}

// Find available Python command
async function findPython() {
  const commands = getPythonCommand();

  for (const cmd of commands) {
    if (await checkPythonCommand(cmd)) {
      return cmd;
    }
  }

  return null;
}

// Launch the server
async function launch() {
  // Find Python
  const pythonCmd = await findPython();

  if (!pythonCmd) {
    console.error('❌ Error: Python not found!');
    console.error('');
    console.error('Selenium MCP Server requires Python 3.10 or higher.');
    console.error('');
    console.error('Please install Python from:');
    console.error('  • https://www.python.org/downloads/');
    console.error('  • Or use your system package manager');
    console.error('');
    process.exit(1);
  }

  // Check if selenium-ai-agent is installed
  const checkInstall = spawn(pythonCmd, ['-m', 'pip', 'show', 'selenium-ai-agent'], {
    stdio: 'pipe'
  });

  checkInstall.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ Error: selenium-ai-agent Python package not found!');
      console.error('');
      console.error('Installing selenium-ai-agent...');
      console.error('');

      // Install the Python package
      const install = spawn(pythonCmd, ['-m', 'pip', 'install', '--break-system-packages', 'selenium-ai-agent'], {
        stdio: 'inherit'
      });

      install.on('close', (installCode) => {
        if (installCode !== 0) {
          console.error('');
          console.error('❌ Failed to install selenium-ai-agent');
          console.error('Please run manually: pip install selenium-ai-agent');
          process.exit(1);
        }

        // After successful install, launch the server
        launchServer(pythonCmd);
      });
    } else {
      // Package already installed, launch the server
      launchServer(pythonCmd);
    }
  });
}

// Launch the MCP server
function launchServer(pythonCmd) {
  const args = ['-m', 'selenium_mcp.server', ...process.argv.slice(2)];

  const server = spawn(pythonCmd, args, {
    stdio: 'inherit',
    env: process.env
  });

  server.on('error', (err) => {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  });

  server.on('close', (code) => {
    process.exit(code || 0);
  });

  // Handle signals
  process.on('SIGINT', () => {
    server.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    server.kill('SIGTERM');
  });
}

// Run
launch().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
