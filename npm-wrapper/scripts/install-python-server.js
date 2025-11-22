#!/usr/bin/env node

/**
 * Post-install script for selenium-mcp-server npm package
 *
 * This script runs after npm install and checks for Python installation.
 * It provides helpful instructions if Python is not available.
 */

import { spawn } from 'child_process';
import { platform } from 'os';

const isWindows = platform() === 'win32';
const pythonCommands = isWindows ? ['python', 'python3', 'py'] : ['python3', 'python'];

async function checkPython(cmd) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, ['--version'], { stdio: 'pipe' });
    proc.on('error', () => resolve(null));
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(cmd);
      } else {
        resolve(null);
      }
    });
  });
}

async function findPython() {
  for (const cmd of pythonCommands) {
    const result = await checkPython(cmd);
    if (result) return result;
  }
  return null;
}

async function checkPythonVersion(pythonCmd) {
  return new Promise((resolve) => {
    const proc = spawn(pythonCmd, ['--version'], { stdio: 'pipe' });
    let version = '';

    proc.stdout.on('data', (data) => {
      version += data.toString();
    });

    proc.on('close', () => {
      const match = version.match(/Python (\d+)\.(\d+)/);
      if (match) {
        const major = parseInt(match[1]);
        const minor = parseInt(match[2]);
        resolve({ major, minor, valid: major === 3 && minor >= 10 });
      } else {
        resolve({ valid: false });
      }
    });
  });
}

async function main() {
  console.log('');
  console.log('📦 Setting up Selenium MCP Server...');
  console.log('');

  // Check for Python
  const pythonCmd = await findPython();

  if (!pythonCmd) {
    console.log('⚠️  Python not found!');
    console.log('');
    console.log('Selenium MCP Server requires Python 3.10 or higher.');
    console.log('');
    console.log('To install Python:');
    console.log('  • Download from: https://www.python.org/downloads/');
    console.log('  • Or use your system package manager:');
    console.log('    - macOS: brew install python3');
    console.log('    - Ubuntu/Debian: sudo apt install python3');
    console.log('    - Windows: winget install Python.Python.3.12');
    console.log('');
    console.log('After installing Python, run: npm install selenium-mcp-server');
    console.log('');
    return;
  }

  console.log(`✅ Found Python: ${pythonCmd}`);

  // Check Python version
  const versionInfo = await checkPythonVersion(pythonCmd);

  if (!versionInfo.valid) {
    console.log('');
    console.log('⚠️  Python version is too old!');
    console.log('');
    console.log('Selenium MCP Server requires Python 3.10 or higher.');
    console.log('Please upgrade your Python installation.');
    console.log('');
    return;
  }

  console.log(`✅ Python version is compatible (${versionInfo.major}.${versionInfo.minor})`);
  console.log('');
  console.log('Installing Python package (this may take a minute)...');
  console.log('');

  // Install the Python package
  const install = spawn(pythonCmd, ['-m', 'pip', 'install', 'selenium-mcp-server'], {
    stdio: 'inherit'
  });

  install.on('close', (code) => {
    console.log('');
    if (code === 0) {
      console.log('✅ Selenium MCP Server installed successfully!');
      console.log('');
      console.log('You can now run: npx selenium-mcp');
      console.log('Or configure in your MCP client:');
      console.log('');
      console.log('  {');
      console.log('    "mcpServers": {');
      console.log('      "selenium-mcp": {');
      console.log('        "command": "npx",');
      console.log('        "args": ["selenium-mcp-server"]');
      console.log('      }');
      console.log('    }');
      console.log('  }');
      console.log('');
    } else {
      console.log('⚠️  Installation warning: pip install returned code', code);
      console.log('');
      console.log('The Python package may not be installed correctly.');
      console.log('You can install it manually with:');
      console.log('  pip install selenium-mcp-server');
      console.log('');
    }
  });
}

main().catch((err) => {
  console.error('Error during setup:', err);
});
