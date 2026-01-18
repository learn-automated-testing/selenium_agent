# Installation Summary - Quick Reference

## Two Installation Methods, Same Result

```
┌─────────────────────────────────────────────────────────────┐
│                    METHOD 1: pip (Python)                    │
└─────────────────────────────────────────────────────────────┘

$ pip install ai-agent-selenium

    ↓

┌─────────────────────────────────────────────────────────────┐
│ Installs to: site-packages/selenium_mcp/                    │
│                                                              │
│ ✅ Python package (server.py, tools/, etc.)                 │
│ ✅ Agent instructions (agents/*.md)                          │
│    - Review gates                                            │
│    - Framework standards                                     │
│    - Workflow instructions                                   │
│ ✅ Documentation (*.md files)                                │
│ ✅ Command: selenium-mcp                                     │
│ ✅ Dependencies (fastmcp, selenium, etc.)                    │
└─────────────────────────────────────────────────────────────┘

Configure in MCP client:
{
  "selenium-mcp": {
    "command": "selenium-mcp"
  }
}
```

```
┌─────────────────────────────────────────────────────────────┐
│                  METHOD 2: npm (Node.js)                     │
└─────────────────────────────────────────────────────────────┘

$ npm install ai-agent-selenium

    ↓

┌─────────────────────────────────────────────────────────────┐
│ Step 1: Installs npm wrapper                                 │
│   → node_modules/ai-agent-selenium/                        │
│      ├── bin/selenium-mcp.js (Node.js wrapper)               │
│      └── scripts/install-python-server.js                    │
└─────────────────────────────────────────────────────────────┘

    ↓ (runs post-install script)

┌─────────────────────────────────────────────────────────────┐
│ Step 2: Checks for Python 3.10+                              │
│   ✅ Found Python: python3                                   │
│   ✅ Version compatible: 3.11                                │
└─────────────────────────────────────────────────────────────┘

    ↓

┌─────────────────────────────────────────────────────────────┐
│ Step 3: Auto-installs Python package                         │
│   $ python -m pip install ai-agent-selenium                │
│                                                              │
│ Installs to: site-packages/selenium_mcp/                    │
│                                                              │
│ ✅ Python package (server.py, tools/, etc.)                 │
│ ✅ Agent instructions (agents/*.md)                          │
│    - Review gates                                            │
│    - Framework standards                                     │
│    - Workflow instructions                                   │
│ ✅ Documentation (*.md files)                                │
│ ✅ Command: npx ai-agent-selenium                          │
│ ✅ Dependencies (fastmcp, selenium, etc.)                    │
└─────────────────────────────────────────────────────────────┘

Configure in MCP client:
{
  "selenium-mcp": {
    "command": "npx",
    "args": ["ai-agent-selenium"]
  }
}
```

---

## What Gets Installed (Both Methods)

### System-Level (site-packages/)

```
Python site-packages/
└── selenium_mcp/
    ├── server.py                    # Main MCP server
    ├── context.py
    ├── tool_base.py
    ├── snapshot.py
    ├── agents/                      # ⭐ CRITICAL - Agent instructions
    │   ├── selenium-test-planner.agent.md
    │   ├── selenium-test-generator.agent.md
    │   └── selenium-test-healer.agent.md
    └── tools/
        ├── navigation.py
        ├── interaction.py
        ├── agents.py                # Python code for agents
        └── ... (40+ tools)
```

**Agent `.md` files contain**:
- Human review requirements (3 gates)
- Framework standards (pytest, Robot, etc.)
- File naming conventions
- Directory detection logic
- Complete workflow

### Documentation Included

```
✅ README.md                    - Main documentation
✅ AGENT_WORKFLOW.md           - Complete workflow with review gates
✅ FRAMEWORK_STANDARDS.md      - Framework conventions
✅ selenium-agent-workflow.png  - Visual workflow diagram
✅ INSTALLATION_GUIDE.md       - Complete installation guide
✅ MCP_CLIENT_SETUP.md         - MCP client configuration
```

---

## What Happens in YOUR New Repo

### Before Using Agents

```
my-project/
├── (your existing files)
└── (empty or minimal structure)
```

### After Using Planner Agent

```
my-project/
├── test-plans/              ← Created by Planner in YOUR repo
│   └── login_plan.md
└── (your existing files)
```

### After Using Generator Agent

```
my-project/
├── test-plans/
│   └── login_plan.md
├── tests/                   ← Created by Generator in YOUR repo
│   └── test_login.py
└── (your existing files)
```

---

## Key Points

### ✅ Agent Instructions Are ALWAYS Included

**Both pip and npm install the agent `.md` files**, which ensure:

```
agents/selenium-test-planner.agent.md
  ↓
Contains: "STOP after saving plan and WAIT for approval"
  ↓
Result: Planner ALWAYS stops and waits for review
```

```
agents/selenium-test-generator.agent.md
  ↓
Contains: "ASK where to save before using generator_write_test"
  ↓
Result: Generator ALWAYS asks for save location approval
```

### ✅ Framework Standards Are Enforced

**Agent instructions include**:
- pytest: `test_*.py` in `tests/`
- Robot Framework: `test_*.robot` in `tests/`
- WebDriverIO: `*.test.js` in `tests/`
- Auto-correction of naming
- Smart directory detection

### ✅ Your Repo Stays Clean

**Package installs to** `site-packages/` (system-level)
**Agents create files in** YOUR repo (`test-plans/`, `tests/`)
**No package files** in your project directory

### ✅ Same Behavior Either Way

**Whether you use pip or npm**:
- Same Python package installed
- Same agent instructions
- Same review gates
- Same framework standards
- Same workflow

---

## Quick Comparison

| Aspect | pip | npm |
|--------|-----|-----|
| **Install command** | `pip install ai-agent-selenium` | `npm install ai-agent-selenium` |
| **Requirements** | Python 3.10+ | Python 3.10+ AND Node.js 16+ |
| **Python package** | ✅ Direct install | ✅ Auto-installed by npm |
| **Node wrapper** | ❌ No | ✅ Yes |
| **Agent files** | ✅ Included | ✅ Included (in Python package) |
| **Review gates** | ✅ Work automatically | ✅ Work automatically |
| **Framework standards** | ✅ Enforced | ✅ Enforced |
| **Run command** | `selenium-mcp` | `npx ai-agent-selenium` |
| **Target users** | Python devs | JavaScript/TypeScript devs |

---

## Configuration Examples

### pip Installation

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "selenium-mcp"
    }
  }
}
```

### npm Installation

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "npx",
      "args": ["ai-agent-selenium"]
    }
  }
}
```

---

## Verification

### Check Installation

**pip**:
```bash
pip show ai-agent-selenium
selenium-mcp --help
```

**npm**:
```bash
npm list ai-agent-selenium
npx ai-agent-selenium --help
```

### Check Agent Files Exist

```bash
# Find Python package location
python -c "import selenium_mcp; print(selenium_mcp.__file__)"

# Then check if agents/ directory exists nearby
# Should see:
#   agents/selenium-test-planner.agent.md
#   agents/selenium-test-generator.agent.md
#   agents/selenium-test-healer.agent.md
```

---

## Summary

### npm is Just a Wrapper

```
npm install
    ↓
Runs post-install script
    ↓
Checks Python
    ↓
pip install ai-agent-selenium
    ↓
Same result as direct pip install
    +
Node.js wrapper for convenience
```

### Final Result (Both Methods)

✅ **System**: Python package with agents in `site-packages/`
✅ **Your Repo**: Only your test files (created by agents)
✅ **Agents**: Follow review gates (from `.md` files)
✅ **Standards**: Framework conventions enforced
✅ **Workflow**: Works automatically

---

## Documentation

- **Complete Guide**: [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md)
- **Workflow**: [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md)
- **Standards**: [FRAMEWORK_STANDARDS.md](FRAMEWORK_STANDARDS.md)
- **Main Docs**: [README.md](../README.md)
