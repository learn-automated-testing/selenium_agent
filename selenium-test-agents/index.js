/**
 * Selenium Test Agents
 *
 * Programmatic API for accessing agent definitions.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AGENTS_DIR = join(__dirname, 'agents');

/**
 * Available agent names
 */
export const AGENTS = {
  PLANNER: 'selenium-test-planner',
  GENERATOR: 'selenium-test-generator',
  HEALER: 'selenium-test-healer'
};

/**
 * Get the content of an agent definition file
 * @param {string} agentName - Name of the agent (e.g., 'selenium-test-planner')
 * @returns {string} The agent definition content
 */
export function getAgentDefinition(agentName) {
  const filePath = join(AGENTS_DIR, `${agentName}.agent.md`);

  if (!existsSync(filePath)) {
    throw new Error(`Agent not found: ${agentName}`);
  }

  return readFileSync(filePath, 'utf-8');
}

/**
 * Get all agent definitions
 * @returns {Object} Object with agent names as keys and definitions as values
 */
export function getAllAgentDefinitions() {
  return {
    [AGENTS.PLANNER]: getAgentDefinition(AGENTS.PLANNER),
    [AGENTS.GENERATOR]: getAgentDefinition(AGENTS.GENERATOR),
    [AGENTS.HEALER]: getAgentDefinition(AGENTS.HEALER)
  };
}

/**
 * Get the path to the agents directory
 * @returns {string} Absolute path to agents directory
 */
export function getAgentsPath() {
  return AGENTS_DIR;
}

export default {
  AGENTS,
  getAgentDefinition,
  getAllAgentDefinitions,
  getAgentsPath
};
