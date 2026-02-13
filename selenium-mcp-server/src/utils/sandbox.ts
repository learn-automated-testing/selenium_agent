import path from 'path';
import { getOutputDir } from './paths.js';

/**
 * Validate that a file path resolves within the output directory.
 * Throws a clear error if the path escapes the sandbox.
 *
 * @param filePath  The path to validate
 * @param allowUnrestricted  If true, skip validation (for --allow-unrestricted-file-access)
 */
export function validateOutputPath(filePath: string, allowUnrestricted = false): void {
  if (allowUnrestricted) return;

  const outputDir = getOutputDir();
  const resolved = path.resolve(filePath);
  const resolvedOutput = path.resolve(outputDir);

  if (!resolved.startsWith(resolvedOutput + path.sep) && resolved !== resolvedOutput) {
    throw new Error(
      `Path "${filePath}" resolves outside the output directory "${outputDir}". ` +
      `All output files must be within the output directory. ` +
      `Set SELENIUM_MCP_OUTPUT_DIR to change the output location, ` +
      `or use --allow-unrestricted-file-access to disable this check.`
    );
  }
}
