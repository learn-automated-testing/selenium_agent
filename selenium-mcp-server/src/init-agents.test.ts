import { describe, it } from 'mocha';
import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { detectServerName, initAgents, loadAgents, parseAgent, renderAgent } from './init-agents.js';
import { getAllTools } from './tools/index.js';

const AGENTS_DIR = path.resolve('agents');

describe('test agents', () => {
  it('only list tools this server really has (the 3.3.x definitions used Playwright names like browser_click)', async () => {
    const real = new Set((await getAllTools()).map(t => t.name));
    for (const agent of loadAgents(AGENTS_DIR)) {
      const unknown = agent.tools.filter(t => !['search', 'edit'].includes(t) && !real.has(t));
      expect(unknown, `${agent.name} lists unknown tools`).to.deep.equal([]);
    }
  });

  it('do not mention Playwright tool names in their instructions', () => {
    for (const agent of loadAgents(AGENTS_DIR)) {
      const leftovers = (agent.instructions.match(/\bbrowser_[a-z_]+/g) ?? []).filter(t => t !== 'browser_generate_locator');
      expect(leftovers, agent.name).to.deep.equal([]);
    }
  });

  it('read agent files with Windows line endings (CRLF) and a byte order mark', () => {
    const text = '\uFEFF---\r\nname: a\r\ndescription: d\r\ntools:\r\n  - navigate_to\r\n---\r\n\r\nDo it.\r\n';
    const agent = parseAgent(text);
    expect(agent.name).to.equal('a');
    expect(agent.tools).to.deep.equal(['navigate_to']);
    expect(agent.instructions).to.equal('Do it.\n');
  });

  it('render Claude Code agents with mcp__<server>__ tool names', () => {
    const planner = loadAgents(AGENTS_DIR).find(a => a.name === 'selenium-test-planner')!;
    const file = renderAgent(planner, 'claude', 'selenium');
    expect(file.path).to.equal('.claude/agents/selenium-test-planner.md');
    expect(file.content).to.match(/tools: Glob, Grep, Read, LS, mcp__selenium__navigate_to/);
    expect(file.content).to.contain('mcp__selenium__planner_explore_page');
  });

  it('render VS Code chat modes and Copilot agents with <server>/<tool>', () => {
    const planner = loadAgents(AGENTS_DIR).find(a => a.name === 'selenium-test-planner')!;
    expect(renderAgent(planner, 'vscode', 'selenium-mcp').content).to.contain("'selenium-mcp/planner_setup_page'");
    expect(renderAgent(planner, 'vscode', 'selenium-mcp').path).to.equal('.github/chatmodes/selenium-test-planner.chatmode.md');
    const copilot = renderAgent(planner, 'copilot', 'selenium-mcp');
    expect(copilot.content).to.contain('selenium-mcp/navigate_to');
    expect(copilot.content).to.contain('selenium-ai-agent@latest');
  });

  it('reuse the server name already in the project, and add the server only when missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-'));
    fs.writeFileSync(path.join(dir, '.mcp.json'), JSON.stringify({ mcpServers: { qa: { command: 'npx', args: ['selenium-ai-agent'] } } }));
    expect(detectServerName(dir)).to.equal('qa');
    const kept = initAgents({ loop: 'claude', cwd: dir, agentsDir: AGENTS_DIR });
    expect(kept.server).to.equal('qa');
    expect(kept.mcpConfig).to.equal(undefined);
    expect(kept.written).to.have.length(5); // planner, generator, healer, migrator, analyzer

    const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-'));
    const added = initAgents({ loop: 'vscode', cwd: fresh, agentsDir: AGENTS_DIR });
    expect(added.server).to.equal('selenium-mcp');
    const vscode = JSON.parse(fs.readFileSync(path.join(fresh, '.vscode/mcp.json'), 'utf8'));
    expect(vscode.servers['selenium-mcp'].args).to.deep.equal(['-y', 'selenium-ai-agent@latest']);
  });
});
