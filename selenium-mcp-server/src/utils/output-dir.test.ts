import { describe, it, afterEach } from 'mocha';
import { expect } from 'chai';
import os from 'os';
import path from 'path';
import { defaultOutputDir, expandHome, getOutputDir, isUsableProjectRoot, resolveOutputDir } from './paths.js';
import { isInside, validateOutputPath } from './sandbox.js';

/**
 * Claude Desktop starts MCP servers with "/" as working folder. Before 3.3.7 that made
 * "/" the output folder, every save went to /test-plans and failed, and the sandbox
 * check compared against "//" so even an explicit folder was "outside the output directory".
 */
describe('output folder (Claude Desktop support)', () => {
  const env = process.env.SELENIUM_MCP_OUTPUT_DIR;
  afterEach(() => {
    if (env === undefined) delete process.env.SELENIUM_MCP_OUTPUT_DIR;
    else process.env.SELENIUM_MCP_OUTPUT_DIR = env;
  });

  it('treats a path under the filesystem root as inside it', () => {
    expect(isInside('/Users/me/plans/a.md', '/')).to.equal(true);
    expect(isInside('/', '/')).to.equal(true);
  });

  it('still refuses paths that escape the output folder', () => {
    expect(isInside('/Users/me/project/../other/a.md', '/Users/me/project')).to.equal(false);
    expect(isInside('/Users/me/projectX/a.md', '/Users/me/project')).to.equal(false);
    expect(isInside('/Users/me/project/sub/a.md', '/Users/me/project')).to.equal(true);
  });

  it('never uses the filesystem root or the home folder as the project', () => {
    expect(isUsableProjectRoot('/')).to.equal(false);
    expect(isUsableProjectRoot(os.homedir())).to.equal(false);
    expect(isUsableProjectRoot(path.join(os.homedir(), 'code', 'shop'))).to.equal(true);
  });

  it('falls back to ~/selenium-ai-agent', () => {
    expect(defaultOutputDir()).to.equal(path.join(os.homedir(), 'selenium-ai-agent'));
  });

  it('expands ~ in SELENIUM_MCP_OUTPUT_DIR and in an outputDir parameter', () => {
    process.env.SELENIUM_MCP_OUTPUT_DIR = '~/tests-out';
    expect(getOutputDir()).to.equal(path.join(os.homedir(), 'tests-out'));
    expect(resolveOutputDir('~/tests-out/plans', '/unused')).to.equal(path.join(os.homedir(), 'tests-out', 'plans'));
    expect(expandHome('~')).to.equal(os.homedir());
  });

  it('accepts files in the configured folder and refuses others', () => {
    process.env.SELENIUM_MCP_OUTPUT_DIR = '/tmp/sel-out';
    expect(() => validateOutputPath('/tmp/sel-out/test-plans/p.md')).not.to.throw();
    expect(() => validateOutputPath('/etc/p.md')).to.throw(/outside the output directory/);
  });
});
