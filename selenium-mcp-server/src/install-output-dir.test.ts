import { expect } from 'chai';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sinon from 'sinon';
import { detectProjectRoot } from './utils/paths.js';
import { handleInstall, outputDirFor } from '../bin/install.js';

describe('the project is the default output folder', () => {
  let tmp: string;
  beforeEach(() => { tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'proj-'))); });

  describe('detectProjectRoot', () => {
    it('finds Java, C#, Python and Node projects, also without git, from a subfolder', () => {
      for (const [marker, file] of [['java', 'pom.xml'], ['gradle', 'build.gradle.kts'], ['dotnet', 'Shop.Tests.csproj'], ['sln', 'Shop.sln'],
        ['py', 'pyproject.toml'], ['req', 'requirements.txt'], ['node', 'package.json']] as const) {
        const root = path.join(tmp, marker);
        fs.mkdirSync(path.join(root, 'src', 'deep'), { recursive: true });
        fs.writeFileSync(path.join(root, file), '');
        expect(detectProjectRoot(path.join(root, 'src', 'deep')), file).to.equal(root);
      }
    });

    it('is null outside any project and never the home folder', () => {
      expect(detectProjectRoot(os.homedir())).to.equal(null);
    });
  });

  describe('install', () => {
    const saved = { cwd: process.cwd() };
    let home: string;
    const config = () => JSON.parse(fs.readFileSync(path.join(home, '.junie', 'mcp', 'mcp.json'), 'utf8')).mcpServers['selenium-mcp'];
    const quiet = (fn: () => void) => { const log = console.log; console.log = () => undefined; try { fn(); } finally { console.log = log; } };
    beforeEach(() => {
      home = path.join(tmp, 'home');
      fs.mkdirSync(home, { recursive: true });
      sinon.stub(os, 'homedir').returns(home);
    });
    afterEach(() => {
      process.chdir(saved.cwd);
      sinon.restore();
    });

    it('outputDirFor: --output-dir wins, else the project it runs in, else none', () => {
      const project = path.join(tmp, 'shop');
      fs.mkdirSync(project);
      fs.writeFileSync(path.join(project, 'pom.xml'), '');
      expect(outputDirFor([], project)).to.deep.equal({ dir: project, explicit: false });
      expect(outputDirFor(['--output-dir=/work/other'], project)).to.deep.equal({ dir: path.resolve('/work/other'), explicit: true });
      expect(outputDirFor([], home).dir).to.equal(null);
    });

    it('run in a project, it writes that project as the output folder', () => {
      const project = path.join(tmp, 'shop');
      fs.mkdirSync(project);
      fs.writeFileSync(path.join(project, 'Shop.Tests.csproj'), '');
      process.chdir(project);
      quiet(() => handleInstall(['junie']));
      expect(config()).to.deep.equal({ command: 'npx', args: ['selenium-ai-agent'], env: { SELENIUM_MCP_OUTPUT_DIR: project } });
    });

    it('does not move an existing setup to another project unless asked with --output-dir', () => {
      const a = path.join(tmp, 'a');
      const b = path.join(tmp, 'b');
      for (const p of [a, b]) { fs.mkdirSync(p); fs.writeFileSync(path.join(p, 'package.json'), '{}'); }
      process.chdir(a);
      quiet(() => handleInstall(['junie']));
      process.chdir(b);
      quiet(() => handleInstall(['junie']));
      expect(config().env.SELENIUM_MCP_OUTPUT_DIR).to.equal(a);
      quiet(() => handleInstall(['junie', `--output-dir=${b}`]));
      expect(config().env.SELENIUM_MCP_OUTPUT_DIR).to.equal(b);
    });

    it('outside a project it writes no output folder (the server then uses ~/selenium-ai-agent)', () => {
      process.chdir(home);
      quiet(() => handleInstall(['junie']));
      expect(config()).to.deep.equal({ command: 'npx', args: ['selenium-ai-agent'] });
    });
  });
});
