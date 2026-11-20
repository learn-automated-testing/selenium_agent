import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  writeProjectRules, projectRulesSection, detectFramework, detectVersion, upsertSection, RULES_START, RULES_END,
} from './project-rules.js';
import { parseWithRules } from '../bin/install.js';

describe('project rules files (--with-rules)', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-')); });
  const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');

  it("covers what Selenium's guide asks every instruction file to include", () => {
    const md = projectRulesSection('selenium-python-pytest', '4.53.0');
    expect(md).to.include('## Browser automation (Selenium 4.53.0)');
    expect(md).to.include('https://www.selenium.dev/llms.txt');                       // the docs index
    expect(md).to.include('seleniumhq.github.io/tree/trunk/examples');                // the examples
    expect(md).to.include('index.md');                                                // fetch the page first
    expect(md).to.include('does not exist');                                          // no invented APIs
    expect(md).to.include('Selenium Manager');
    expect(md).to.include('find_element_by_*');                                       // Python notes
    expect(md).to.include('selenium://rules/python');
  });

  it('gives Java notes for Java, Robot keywords for Robot, and WebdriverIO its own section', () => {
    expect(projectRulesSection('selenium-java-maven', null)).to.include('java.time.Duration');
    expect(projectRulesSection('robot-framework', null)).to.include('Set Selenium Speed');
    const wdio = projectRulesSection('webdriverio-ts', null);
    expect(wdio).to.include('## End-to-end tests (WebdriverIO v10)');
    expect(wdio).to.include('https://webdriver.io/llms.txt');
    expect(wdio).to.include('browser.pause()');
    expect(wdio).not.to.include('selenium.dev/llms.txt');
  });

  it('detects the framework and the pinned version from the project', () => {
    expect(detectFramework(dir)).to.equal('selenium-python-pytest');
    fs.writeFileSync(path.join(dir, 'requirements.txt'), 'pytest\nselenium==4.53.0\n');
    expect(detectVersion(dir, 'selenium-python-pytest')).to.equal('4.53.0');
    fs.writeFileSync(path.join(dir, 'pom.xml'), '<properties><selenium.version>4.49.0</selenium.version></properties>');
    expect(detectFramework(dir)).to.equal('selenium-java-maven');
    expect(detectVersion(dir, 'selenium-java-maven')).to.equal('4.49.0');
    fs.writeFileSync(path.join(dir, 'package.json'), '{"devDependencies":{"@wdio/cli":"^9.20.0"}}');
    expect(detectFramework(dir)).to.equal('webdriverio-ts');
    expect(detectVersion(dir, 'webdriverio-ts')).to.equal('9.20.0');
  });

  it('appends to an existing CLAUDE.md and replaces only its own section when run again', () => {
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# My project\n\nUse tabs.\n');
    writeProjectRules({ cwd: dir, targets: ['claude'], framework: 'selenium-python-pytest' });
    writeProjectRules({ cwd: dir, targets: ['claude'], framework: 'selenium-java-maven' });
    const text = read('CLAUDE.md');
    expect(text.startsWith('# My project\n\nUse tabs.\n')).to.equal(true);
    expect(text.split(RULES_START)).to.have.length(2);       // one section, not two
    expect(text).to.include('java.time.Duration');            // the second run replaced it
    expect(text).not.to.include('find_element_by_*');
  });

  it('writes Cursor, Copilot, Windsurf and AGENTS.md files where those tools look', () => {
    const result = writeProjectRules({ cwd: dir, targets: ['cursor', 'copilot', 'windsurf', 'agents'] });
    expect(result.written.map(w => w.file)).to.deep.equal([
      '.cursor/rules/selenium.mdc', '.github/copilot-instructions.md', '.windsurf/rules/selenium.md', 'AGENTS.md',
    ]);
    expect(result.written.every(w => w.action === 'created')).to.equal(true);
    const mdc = read('.cursor/rules/selenium.mdc');
    expect(mdc.startsWith('---\ndescription:')).to.equal(true);
    expect(mdc).to.include('alwaysApply: true');
    expect(read('AGENTS.md')).to.include(RULES_END);
  });

  it('upsertSection appends to text, fills an empty file and replaces an old section', () => {
    expect(upsertSection('', 'A')).to.equal(`${RULES_START}\nA\n${RULES_END}\n`);
    const once = upsertSection('intro\n', 'A');
    expect(once).to.equal(`intro\n\n${RULES_START}\nA\n${RULES_END}\n`);
    expect(upsertSection(once + 'outro\n', 'B')).to.equal(`intro\n\n${RULES_START}\nB\n${RULES_END}\noutro\n`);
  });

  it('parses --with-rules with a default target or a list', () => {
    expect(parseWithRules([], 'cursor')).to.equal(null);
    expect(parseWithRules(['--with-rules'], 'cursor')).to.deep.equal(['cursor']);
    expect(parseWithRules(['--with-rules'])).to.deep.equal([]);
    expect(parseWithRules(['--with-rules=claude,agents'], 'cursor')).to.deep.equal(['claude', 'agents']);
    expect(() => parseWithRules(['--with-rules=emacs'])).to.throw('Unknown --with-rules target: emacs');
  });
});
