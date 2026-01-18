# Selenium Test Agents

AI-powered test agents for Selenium - Planner, Generator, and Healer agents for automated test creation and maintenance.

## Overview

This package provides three AI agents that work with the [selenium-agent](https://www.npmjs.com/package/selenium-ai-agent) MCP server:

| Agent | Purpose |
|-------|---------|
| **Planner** | Explores your app and creates comprehensive test plans |
| **Generator** | Generates test code from approved test plans |
| **Healer** | Debugs and fixes failing tests automatically |

## Installation

```bash
# Install in your project
npm install -D selenium-test-agents

# Initialize agents
npx selenium-agents init
```

This creates a `.agents/` folder in your project with the agent definition files.

## Prerequisites

Make sure you have the selenium-agent MCP server configured in your AI tool:

**Cursor/Claude Desktop config:**
```json
{
  "mcpServers": {
    "selenium": {
      "command": "npx",
      "args": ["selenium-agent"]
    }
  }
}
```

## Usage

After initialization, use the agents in your AI coding tool (Cursor, Claude, VS Code with Copilot, etc.):

### 1. Create Test Plans (Planner)

```
"Use selenium-test-planner to create a test plan for the login page at https://myapp.com/login"
```

The planner will:
- Explore your web application
- Identify test scenarios and user flows
- Create a structured test plan in `test-plans/`
- **Stop and wait for your review**

### 2. Generate Test Code (Generator)

```
"Generate pytest tests from test-plans/login_test_plan.md using selenium-test-generator"
```

The generator will:
- Read your approved test plan
- Ask which framework (pytest, Robot Framework, etc.)
- Execute scenarios on the live site
- Generate test code
- **Ask where to save the files**

### 3. Fix Failing Tests (Healer)

```
"Fix the failing tests in tests/test_login.py using selenium-test-healer"
```

The healer will:
- Run your test suite
- Identify failures
- Debug and suggest fixes
- Apply fixes and verify

## Workflow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Planner     │ ──► │    Generator    │ ──► │     Healer      │
│                 │     │                 │     │                 │
│ Creates test    │     │ Generates code  │     │ Fixes failures  │
│ plans           │     │ from plans      │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
   test-plans/             tests/*.py              tests/*.py
                          tests/*.robot            (fixed)
```

## Commands

```bash
# Initialize agents in your project
npx selenium-agents init

# List available agents
npx selenium-agents list

# Show help
npx selenium-agents help
```

## Agent Files

After `init`, you'll have these files in `.agents/`:

- `selenium-test-planner.agent.md` - Test planning agent
- `selenium-test-generator.agent.md` - Code generation agent
- `selenium-test-healer.agent.md` - Test fixing agent

These are instruction files that tell your AI assistant how to use the selenium-agent MCP tools effectively.

## Supported Test Frameworks

The generator agent supports:

- **pytest** (Python)
- **Robot Framework** (Python)
- **unittest** (Python)
- **WebDriverIO** (JavaScript/TypeScript)

## Example Project Structure

After using the agents:

```
my-project/
├── .agents/
│   ├── selenium-test-planner.agent.md
│   ├── selenium-test-generator.agent.md
│   └── selenium-test-healer.agent.md
├── test-plans/
│   └── login_test_plan.md
├── tests/
│   ├── test_login.py
│   └── test_checkout.py
└── package.json
```

## Related Packages

- [selenium-ai-agent](https://www.npmjs.com/package/selenium-ai-agent) - MCP server with browser automation tools
- [@playwright/mcp](https://www.npmjs.com/package/@playwright/mcp) - Similar concept for Playwright

## License

MIT
