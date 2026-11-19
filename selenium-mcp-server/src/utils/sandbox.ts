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
  if (!isInside(filePath, outputDir)) {
    throw new Error(
      `Path "${filePath}" resolves outside the output directory "${outputDir}". ` +
      `All output files must be within the output directory. ` +
      `Set SELENIUM_MCP_OUTPUT_DIR to change the output location, ` +
      `or use --allow-unrestricted-file-access to disable this check.`
    );
  }
}

/**
 * True when `filePath` is `dir` itself or inside it. Uses path.relative, so it also
 * works when `dir` is a filesystem root ("/" or "C:\\"), where "dir + sep" would be "//".
 */
export function isInside(filePath: string, dir: string): boolean {
  const rel = path.relative(path.resolve(dir), path.resolve(filePath));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
