import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DEFAULT_FRAMEWORK, GeneratorWriteTestTool } from './generator.js';

const ctx = (framework?: string) => ({ generatorFramework: framework, clearRecording: () => undefined }) as never;

describe('generator framework default and manifest', () => {
  let root: string;
  const env = process.env.SELENIUM_MCP_OUTPUT_DIR;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-')); process.env.SELENIUM_MCP_OUTPUT_DIR = root; });
  afterEach(() => { if (env === undefined) delete process.env.SELENIUM_MCP_OUTPUT_DIR; else process.env.SELENIUM_MCP_OUTPUT_DIR = env; });
  const manifest = () => JSON.parse(fs.readFileSync(path.join(root, '.test-manifest.json'), 'utf8'));

  it('writes Python + pytest when no framework is named', async () => {
    expect(DEFAULT_FRAMEWORK).to.equal('selenium-python-pytest');
    await new GeneratorWriteTestTool().execute(ctx(), {
      testCode: 'def test_x(): pass', filename: 'test_x.py', outputDir: path.join(root, 'tests'), projectRoot: root,
    });
    expect(manifest().framework).to.equal('selenium-python-pytest');
    expect(manifest().runCommand.command).to.equal('pytest');
  });

  it('keeps a run command set earlier when a later test gives none', async () => {
    const tool = new GeneratorWriteTestTool();
    const base = { outputDir: path.join(root, 'tests'), projectRoot: root };
    await tool.execute(ctx(), { ...base, testCode: 'def test_a(): pass', filename: 'test_a.py', runCommand: { command: '.venv/bin/pytest', args: [] } });
    await tool.execute(ctx(), { ...base, testCode: 'def test_b(): pass', filename: 'test_b.py' });
    // The command stays; the JUnit XML report is added to it.
    expect(manifest().runCommand).to.deep.equal({ command: '.venv/bin/pytest', args: ['--junitxml=reports/junit.xml'] });
    expect(manifest().reporting).to.equal('junit');
    expect(manifest().tests).to.have.length(2);
  });

  it('uses the framework chosen in generator_setup_page', async () => {
    await new GeneratorWriteTestTool().execute(ctx('selenium-java-maven'), {
      testCode: 'class CartTest {}', filename: 'CartTest.java', outputDir: path.join(root, 'src/test/java'), projectRoot: root,
    });
    expect(manifest().framework).to.equal('selenium-java-maven');
    expect(manifest().runCommand.command).to.equal('mvn');
  });
});
