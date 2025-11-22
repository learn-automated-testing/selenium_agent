/**
 * Selenium MCP Server - Node.js Wrapper
 *
 * This package provides a Node.js launcher for the Python-based
 * Selenium MCP Server with AI-powered test agents.
 *
 * @module selenium-mcp-server
 */

import { spawn } from 'child_process';
import { platform } from 'os';

/**
 * Start the Selenium MCP Server
 *
 * @param {Object} options - Configuration options
 * @param {string[]} options.args - Additional arguments to pass to the server
 * @param {boolean} options.stdio - Whether to inherit stdio (default: true)
 * @returns {ChildProcess} The spawned server process
 *
 * @example
 * import { startServer } from 'selenium-mcp-server';
 *
 * const server = startServer({
 *   args: ['--help'],
 *   stdio: true
 * });
 *
 * server.on('close', (code) => {
 *   console.log('Server exited with code', code);
 * });
 */
export function startServer(options = {}) {
  const { args = [], stdio = true } = options;

  const isWindows = platform() === 'win32';
  const pythonCommands = isWindows ? ['python', 'python3', 'py'] : ['python3', 'python'];

  // Try to find Python
  let pythonCmd = pythonCommands[0];

  const serverArgs = ['-m', 'selenium_mcp.server', ...args];

  const server = spawn(pythonCmd, serverArgs, {
    stdio: stdio ? 'inherit' : 'pipe',
    env: process.env
  });

  return server;
}

/**
 * Get the version of the installed Selenium MCP Server
 *
 * @returns {Promise<string>} The version string
 *
 * @example
 * import { getVersion } from 'selenium-mcp-server';
 *
 * const version = await getVersion();
 * console.log('Selenium MCP Server version:', version);
 */
export async function getVersion() {
  return new Promise((resolve, reject) => {
    const isWindows = platform() === 'win32';
    const pythonCmd = isWindows ? 'python' : 'python3';

    const proc = spawn(pythonCmd, ['-m', 'pip', 'show', 'selenium-mcp-server'], {
      stdio: 'pipe'
    });

    let output = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        const match = output.match(/Version: (.+)/);
        if (match) {
          resolve(match[1].trim());
        } else {
          reject(new Error('Version not found in pip output'));
        }
      } else {
        reject(new Error('selenium-mcp-server not installed'));
      }
    });
  });
}

export default {
  startServer,
  getVersion
};
