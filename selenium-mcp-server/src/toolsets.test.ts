import { describe, it, afterEach } from 'mocha';
import { expect } from 'chai';

import { parseToolsets, TOOLSET_NAMES } from './toolsets.js';
import { getAllTools } from './tools/index.js';

describe('toolsets', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('parseToolsets', () => {
    it('enables everything when unset, empty or "all"', () => {
      for (const raw of [undefined, '', '  ', 'all', 'core,all']) {
        expect([...parseToolsets(raw).enabled]).to.have.members([...TOOLSET_NAMES]);
      }
    });

    it('always includes core', () => {
      expect([...parseToolsets('healer').enabled]).to.have.members(['core', 'healer']);
    });

    it('pulls in recording for the generator', () => {
      expect([...parseToolsets('generator').enabled]).to.have.members(['core', 'generator', 'recording']);
    });

    it('is case and whitespace tolerant and reports unknown names', () => {
      const result = parseToolsets(' Core , HEALER, magic ');
      expect([...result.enabled]).to.have.members(['core', 'healer']);
      expect(result.unknown).to.deep.equal(['magic']);
    });
  });

  describe('getAllTools', () => {
    const names = async () => (await getAllTools()).map(t => t.name);

    it('exposes all 62 non-grid tools by default', async () => {
      delete process.env.SELENIUM_GRID_URL;
      delete process.env.SELENIUM_MCP_TOOLSETS;
      expect(await names()).to.have.length(62);
    });

    it('exposes only the 38 core tools (with get_selenium_docs) for "core"', async () => {
      delete process.env.SELENIUM_GRID_URL;
      process.env.SELENIUM_MCP_TOOLSETS = 'core';
      const result = await names();
      expect(result).to.have.length(38);
      expect(result).to.include('get_selenium_docs');
      expect(result).to.include('navigate_to');
      expect(result).to.include('batch_execute');
      expect(result).to.not.include('generator_write_test');
    });

    it('adds generator and recording tools on request', async () => {
      delete process.env.SELENIUM_GRID_URL;
      process.env.SELENIUM_MCP_TOOLSETS = 'core,generator';
      const result = await names();
      expect(result).to.include('generator_write_test');
      expect(result).to.include('start_recording');
      expect(result).to.not.include('healer_fix_test');
    });

    it('hides grid tools when the grid toolset is not enabled', async () => {
      process.env.SELENIUM_GRID_URL = 'http://127.0.0.1:1';
      process.env.SELENIUM_MCP_TOOLSETS = 'core';
      expect(await names()).to.not.include('grid_status');
    });
  });
});
