# Complete Installation Guide

## Overview

The `selenium-mcp-server` package can be installed in **two ways**:
1. **Direct Python installation** (pip)
2. **Node.js wrapper** (npm) - automatically installs Python package

This guide explains both methods and what happens in each case.

---

## Installation Method 1: Python (pip)

### For Python Developers

**Install from PyPI**:
```bash
pip install ai-agent-selenium
```

**Install from GitHub**:
```bash
pip install git+https://github.com/learn-automated-testing/selenium-mcp-server.git
```

### What Gets Installed

#### 1. Python Package Structure
```
site-packages/
└── selenium_mcp/                   # Main package
    ├── __init__.py
    ├── server.py                   # MCP server
    ├── context.py                  # Browser context
    ├── tool_base.py
    ├── snapshot.py
    └── tools/
        ├── navigation.py
        ├── interaction.py
        ├── agents.py              # Planner, Generator, Healer
        └── ... (other tools)
```

#### 2. Agent Instructions (The Important Part!)
```
site-packages/selenium_mcp/agents/  # or site-packages/agents/
├── selenium-test-planner.agent.md      # Planner instructions
├── selenium-test-generator.agent.md    # Generator instructions
└── selenium-test-healer.agent.md       # Healer instructions
```

**These files contain**:
- ✅ Human review gate requirements
- ✅ Framework standards (pytest, Robot, etc.)
- ✅ File naming conventions
- ✅ Directory detection logic
- ✅ Complete workflow instructions

#### 3. Documentation Files
```
site-packages/mcp_selenium_server-1.0.0.dist-info/
├── AGENT_WORKFLOW.md              # Complete workflow guide
├── FRAMEWORK_STANDARDS.md         # Framework conventions
├── selenium-agent-workflow.png    # Visual workflow diagram
├── MCP_CLIENT_SETUP.md            # MCP client configuration
└── README.md
```

#### 4. Command-Line Tool
```bash
selenium-mcp    # Available globally after install
```

#### 5. Dependencies (Auto-installed)
```
fastmcp>=2.0.0
selenium>=4.0.0
webdriver-manager>=4.0.0
pydantic>=2.0.0
```

### Configuration

Add to your MCP client config (e.g., Claude Desktop):

**macOS/Linux**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "selenium-mcp"
    }
  }
}
```

---

## Installation Method 2: Node.js Wrapper (npm)

### For JavaScript/TypeScript Developers

**Install from npm** (when published):
```bash
npm install ai-agent-selenium
```

**Or with npx** (no installation):
```bash
npx ai-agent-selenium
```

### What Happens During `npm install`

#### Step 1: npm Package Installation
```
node_modules/
└── ai-agent-selenium/
    ├── package.json
    ├── index.js
    ├── bin/
    │   └── selenium-mcp.js       # Node.js wrapper script
    ├── scripts/
    │   └── install-python-server.js
    └── README.md
```

#### Step 2: Automatic Python Package Installation

**The npm package runs a post-install script**:

```javascript
// package.json
{
  "scripts": {
    "postinstall": "node scripts/install-python-server.js"
  }
}
```

**What the post-install script does**:

1. ✅ **Checks for Python** (version 3.10+)
   ```
   📦 Setting up Selenium MCP Server...
   ✅ Found Python: python3
   ✅ Python version is compatible (3.11)
   ```

2. ✅ **Installs Python package automatically**
   ```bash
   python -m pip install ai-agent-selenium
   ```

3. ✅ **Everything from Method 1 gets installed**:
   - Python package (`selenium_mcp/`)
   - Agent instructions (`agents/*.md`)
   - Documentation files
   - Command-line tool
   - All dependencies

#### Step 3: Node.js Wrapper Created

The npm package provides a Node.js wrapper that:
- Finds your Python installation
- Launches the Python MCP server
- Handles cross-platform compatibility

### What You Get with npm Install

```
Your Project:
├── node_modules/
│   └── ai-agent-selenium/       # npm package (wrapper)
│       ├── bin/selenium-mcp.js
│       └── scripts/
│
Python site-packages/:
└── selenium_mcp/                  # Python package (actual server)
    ├── server.py
    ├── agents/                    # Agent instructions
    │   ├── selenium-test-planner.agent.md
    │   ├── selenium-test-generator.agent.md
    │   └── selenium-test-healer.agent.md
    └── tools/
```

### Configuration for npm Installation

**Claude Desktop/Cursor**:
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

**Or if installed locally in project**:
```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "node",
      "args": ["./node_modules/ai-agent-selenium/bin/selenium-mcp.js"]
    }
  }
}
```

---

## Comparison: pip vs npm

| Aspect | pip (Python) | npm (Node.js) |
|--------|-------------|---------------|
| **Target Users** | Python developers | JavaScript/TypeScript developers |
| **Installation** | `pip install ai-agent-selenium` | `npm install ai-agent-selenium` |
| **Python Required** | Yes, must be pre-installed | Yes, auto-detected & used |
| **Package Type** | Pure Python package | Node.js wrapper + Python package |
| **Final Result** | Python package installed | Python package + Node.js wrapper |
| **Agent Files** | ✅ Included in Python package | ✅ Included in Python package |
| **Documentation** | ✅ Included in Python package | ✅ Included in Python package |
| **Command** | `selenium-mcp` | `npx ai-agent-selenium` |
| **MCP Config** | `"command": "selenium-mcp"` | `"command": "npx", "args": ["ai-agent-selenium"]` |

### Key Point: Same Result Either Way

**Both methods install the same Python package**, which includes:
- ✅ All 40+ browser automation tools
- ✅ Three AI agents (Planner, Generator, Healer)
- ✅ Agent instruction files with review gates
- ✅ Framework standards
- ✅ Complete documentation

The npm version is just a **convenient wrapper** for JavaScript developers.

---

## What Happens When You Use the Agents (Either Method)

Regardless of installation method, when you use the agents in a **new repository**:

### Using Planner Agent

```
Your New Repo:
my-project/
└── (empty or existing project)

User: "Create test plan for login feature"

Planner Agent:
1. ✅ Reads instructions from installed agents/selenium-test-planner.agent.md
2. ✅ Explores your application
3. ✅ Creates test-plans/ directory in YOUR repo
4. ✅ Saves plan: test-plans/login_plan.md
5. ⏸️  STOPS and waits for approval (per agent instructions)

Your Repo Now:
my-project/
└── test-plans/
    └── login_plan.md          # Created in YOUR repo
```

### Using Generator Agent

```
User: "Generate pytest tests from approved plan"

Generator Agent:
1. ✅ Reads instructions from installed agents/selenium-test-generator.agent.md
2. ✅ Asks: "Which framework?" (per agent instructions)
3. ✅ Executes test scenarios
4. ✅ Generates test code
5. ✅ Detects YOUR repo structure (per agent instructions)
6. ✅ Asks: "Where to save?" (per agent instructions)
   - Option 1: tests/ (if exists in YOUR repo)
   - Option 2: Create tests/ directory
   - Option 3: Custom path
7. ⏸️  STOPS and waits for location approval
8. ✅ Saves to YOUR approved location

Your Repo Now:
my-project/
├── test-plans/
│   └── login_plan.md
└── tests/
    └── test_login.py          # Created in YOUR repo
```

---

## Directory Structure After Installation

### Python Installation (pip)

```
System:
├── /usr/local/lib/python3.x/site-packages/  (or similar)
│   └── selenium_mcp/
│       ├── server.py
│       ├── agents/
│       │   ├── selenium-test-planner.agent.md
│       │   ├── selenium-test-generator.agent.md
│       │   └── selenium-test-healer.agent.md
│       └── tools/
│
Your Project:
my-project/
├── test-plans/          # Created by Planner
│   └── *.md
├── tests/               # Created by Generator
│   └── test_*.py
└── requirements.txt
```

### Node.js Installation (npm)

```
System:
├── /usr/local/lib/python3.x/site-packages/
│   └── selenium_mcp/          # Python package (installed by npm)
│       ├── server.py
│       ├── agents/
│       │   └── *.agent.md
│       └── tools/
│
Your Project:
my-project/
├── node_modules/
│   └── ai-agent-selenium/   # npm wrapper
│       ├── bin/
│       └── scripts/
├── test-plans/                # Created by Planner
│   └── *.md
├── tests/                     # Created by Generator
│   └── test_*.py
├── package.json
└── package-lock.json
```

---

## Agent Instructions Are ALWAYS Included

### Critical Point

**Regardless of installation method**, the agent instruction files are installed with the package:

```
agents/
├── selenium-test-planner.agent.md
├── selenium-test-generator.agent.md
└── selenium-test-healer.agent.md
```

**These files ensure**:
- ✅ Review gates work automatically
- ✅ Framework standards are enforced
- ✅ Workflow is consistent
- ✅ No configuration needed

### What Agent Files Contain

**Planner Agent** (`selenium-test-planner.agent.md`):
```markdown
## CRITICAL: Human Review Required

After saving test plan:
1. STOP - Do not proceed
2. PRESENT plan to user
3. WAIT for approval
4. ASK for feedback
```

**Generator Agent** (`selenium-test-generator.agent.md`):
```markdown
## CRITICAL: Framework Standards

File naming conventions:
- pytest: test_*.py
- Robot: test_*.robot
...

## MANDATORY: Ask User Before Saving

1. Detect existing structure
2. Suggest filename
3. ASK where to save
4. WAIT for approval
```

---

## Troubleshooting

### Python Not Found (npm installation)

If npm post-install fails:

```bash
npm install ai-agent-selenium
# Output:
⚠️  Python not found!
```

**Solution**:
1. Install Python 3.10+ from https://www.python.org/
2. Run `npm install ai-agent-selenium` again

### Manual Python Package Installation

If automatic installation fails:

```bash
# Install Python package manually
pip install ai-agent-selenium

# Then npm package will work
npm install ai-agent-selenium
```

### Verify Installation

**Check Python package**:
```bash
pip show ai-agent-selenium
selenium-mcp --help
```

**Check npm package** (if using npm):
```bash
npm list ai-agent-selenium
npx ai-agent-selenium --help
```

### Access Documentation After Install

**Method 1: Find package location**
```bash
python -c "import selenium_mcp; print(selenium_mcp.__file__)"
# Look in that directory for docs
```

**Method 2: GitHub**
- Always available: https://github.com/learn-automated-testing/selenium-mcp-server

---

## What Does NOT Get Installed (Your Repo Stays Clean)

### Package Does NOT Include

❌ **Your test files** (`tests/` in YOUR repo)
❌ **Your test plans** (`test-plans/` in YOUR repo)
❌ **Example projects** (just in source repo)
❌ **Development files** (`.git`, `.gitignore`, etc.)

### These Are Created by Agents in YOUR Repo

✅ `test-plans/` - Created by Planner agent
✅ `tests/` - Created by Generator agent
✅ Your custom project files

---

## Summary

### pip Installation
```bash
# Install
pip install ai-agent-selenium

# What you get
✅ Python package with all tools
✅ Agent instructions (with review gates)
✅ Documentation
✅ Command: selenium-mcp
```

### npm Installation
```bash
# Install
npm install ai-agent-selenium

# What happens
1. npm installs Node.js wrapper
2. Post-install script checks Python
3. Auto-installs Python package via pip
4. You get everything from pip install
   PLUS Node.js wrapper

# What you get
✅ Python package with all tools
✅ Agent instructions (with review gates)
✅ Documentation
✅ Node.js wrapper
✅ Command: npx ai-agent-selenium
```

### In Both Cases

**Agent behavior is identical**:
- ✅ Review gates enforced (from agent `.md` files)
- ✅ Framework standards applied
- ✅ Smart directory detection
- ✅ Professional code generation
- ✅ Complete workflow

**Your repo only contains**:
- Your test plans (created by Planner)
- Your test files (created by Generator)
- Your project configuration

**Package installs to**:
- Python: `site-packages/selenium_mcp/`
- npm: `node_modules/ai-agent-selenium/` + `site-packages/selenium_mcp/`

---

## Recommended Installation

| If you're using... | Install with... | Command |
|-------------------|----------------|---------|
| Python projects | pip | `pip install ai-agent-selenium` |
| Node.js/TypeScript projects | npm | `npm install ai-agent-selenium` |
| Just want to try it | npx | `npx ai-agent-selenium` |
| Both Python & Node.js | Either (same result) | Your preference |

---

## Next Steps After Installation

1. **Configure MCP Client** (Claude Desktop/Cursor)
2. **Start using agents**: "Create test plan for..."
3. **Follow review gates**: Approve when prompted
4. **Read docs**: [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md)

Everything works automatically - no additional setup needed!
