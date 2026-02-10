import path from 'path';
import { spawn } from 'child_process';
import { getOutputDir } from './paths.js';

/**
 * Resolves the path to the docker-compose file.
 *
 * Priority:
 *   1. SELENIUM_COMPOSE_FILE env var (explicit override)
 *   2. `selenium-grid/docker-compose.yml` relative to project root
 */
export function getComposeFilePath(): string {
  if (process.env.SELENIUM_COMPOSE_FILE) {
    const envPath = process.env.SELENIUM_COMPOSE_FILE;
    return path.isAbsolute(envPath) ? envPath : path.resolve(getOutputDir(), envPath);
  }
  return path.join(getOutputDir(), 'selenium-grid', 'docker-compose.yml');
}

/**
 * Runs a docker compose command with the resolved compose file.
 * Returns stdout, stderr, and exit code.
 */
export function runDockerCompose(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const composeFile = getComposeFilePath();
  const fullArgs = ['compose', '-f', composeFile, ...args];

  return new Promise((resolve, reject) => {
    const proc = spawn('docker', fullArgs, { shell: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      resolve({ exitCode: code ?? 0, stdout, stderr });
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}
