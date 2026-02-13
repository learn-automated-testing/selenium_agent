# Selenium MCP Server

[![npm version](https://img.shields.io/npm/v/selenium-ai-agent.svg)](https://www.npmjs.com/package/selenium-ai-agent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Selenium Grid](https://img.shields.io/badge/Selenium%20Grid-Parallel-blue.svg)](https://www.selenium.dev/documentation/grid/)

### One-Click Install

[![Install in VS Code](https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF)](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522selenium-mcp%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522selenium-ai-agent%2522%255D%257D) [![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5)](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522selenium-mcp%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522selenium-ai-agent%2522%255D%257D) [![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=selenium-mcp&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyJzZWxlbml1bS1haS1hZ2VudCJdfQ%3D%3D)

**The first MCP server with true parallel browser automation using Selenium Grid.**

While other browser MCP servers run a single browser instance, Selenium MCP Server connects to Selenium Grid for **massive parallel exploration** — spin up 10, 20, or 100 browser sessions and explore your entire application simultaneously.

<p align="center">
  <img src="docs/selenium-agent-workflow.png" alt="Selenium Agent Workflow" width="700"/>
</p>

## Why This Over Playwright MCP?

| Feature | Playwright MCP | Selenium MCP Server |
|---------|---------------|---------------------|
| **Parallelism** | Single browser, shared context | True parallel: Grid with unlimited nodes |
| **Scaling** | Limited by single browser | Horizontally scalable — add nodes as needed |
| **Isolation** | Shared state between clients | Full isolation per session |
| **Multi-browser** | One at a time | Chrome + Firefox + Edge simultaneously |
| **Infrastructure** | Simple | Docker Compose ready |
| **AI Agent workflows** | Basic | Planner → Generator → Healer pipeline |

**Perfect for:** AI agents that need to explore large applications fast, cross-browser testing, and enterprise automation at scale.

## Quick Start

### 1. Install

```bash
# Install globally
npm install -g selenium-ai-agent

# Or run directly with npx (no install needed)
npx selenium-ai-agent
```

### 2. Configure Your MCP Client

**Claude Code:**
```bash
claude mcp add selenium-mcp -- npx selenium-ai-agent
```

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "npx",
      "args": ["selenium-ai-agent"]
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "npx",
      "args": ["selenium-ai-agent"]
    }
  }
}
```

**GitHub Copilot** (`.vscode/mcp.json`):
```json
{
  "servers": {
    "selenium-mcp": {
      "command": "npx",
      "args": ["selenium-ai-agent"],
      "type": "stdio"
    }
  }
}
```

> See [MCP Client Setup](docs/MCP_CLIENT_SETUP.md) for all 6 clients (Claude Code, Claude Desktop, Cursor, Copilot, Cline, Windsurf).

### 3. Try It!

```
"Navigate to https://example.com and take a screenshot"
```

## Parallel Exploration with Selenium Grid

Explore your entire application in seconds, not minutes:

### Start the Grid

```bash
git clone https://github.com/learn-automated-testing/selenium_agent.git
cd selenium_agent/selenium-grid
docker-compose up -d

# Verify Grid is running
open http://localhost:4444  # Grid console
```

### Configure with Grid

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "npx",
      "args": ["selenium-ai-agent"],
      "env": {
        "SELENIUM_GRID_URL": "http://localhost:4444"
      }
    }
  }
}
```

### Explore in Parallel

```
"Explore the e-commerce site at https://practiceautomatedtesting.com in parallel —
check the homepage, products, cart, and checkout sections simultaneously"
```

The agent will spin up 4 browser sessions on your Grid and explore all sections at once.

```typescript
// What happens behind the scenes:
parallel_explore({
  baseUrl: "https://myshop.com",
  targets: [
    { url: "/", label: "Homepage", maxPages: 10 },
    { url: "/products", label: "Catalog", maxPages: 20 },
    { url: "/cart", label: "Cart Flow", maxPages: 5 },
    { url: "/account", label: "User Account", maxPages: 10 }
  ]
})
// → 4 browsers explore simultaneously
// → Results merged and deduplicated
// → Complete site map in one call
```

**Scale up anytime:**
```bash
docker-compose up -d --scale chrome-node=10
```

## 73 Tools

### Grid & Parallel Execution
| Tool | Description |
|------|-------------|
| `grid_status` | Check Grid health, nodes, and capacity |
| `grid_start` | Start Docker Compose Grid |
| `grid_stop` | Stop Docker Compose Grid |
| `grid_scale` | Scale Grid nodes up/down |
| `session_create` | Create browser session on Grid |
| `session_select` | Switch active session |
| `session_list` | List all Grid sessions |
| `session_destroy` | Clean up a session |
| `session_destroy_all` | Clean up all sessions |
| `parallel_explore` | Explore multiple URLs simultaneously |
| `parallel_execute` | Run tasks in parallel across sessions |
| `exploration_merge` | Combine exploration results |
| `exploration_diff` | Compare explorations |
| `planner_generate_plan` | Generate test plan from exploration |

### Navigation
`navigate_to` · `go_back` · `go_forward` · `refresh_page`

### Page Analysis
`capture_page` · `take_screenshot`

### Element Interactions
`click_element` · `hover_element` · `select_option` · `drag_drop`

### Input
`input_text` · `key_press` · `file_upload`

### Mouse
`mouse_move` · `mouse_click` · `mouse_drag`

### Verification
`verify_element_visible` · `verify_text_visible` · `verify_value` · `verify_list_visible`

### Browser Management
`wait_for` · `execute_javascript` · `dialog_handle` · `console_logs` · `network_monitor` · `resize_window` · `pdf_generate`

### Tabs
`tab_list` · `tab_select` · `tab_new` · `tab_close`

### Session
`close_browser` · `reset_session` · `set_stealth_mode`

### Recording
`start_recording` · `stop_recording` · `recording_status` · `clear_recording`

### Batch
`batch_execute`

### AI Agent Tools
| Agent | Tools |
|-------|-------|
| **Planner** | `planner_setup_page`, `planner_explore_page`, `planner_save_plan` |
| **Generator** | `generator_setup_page`, `generator_read_log`, `generator_write_test`, `generator_write_seed`, `generator_save_spec`, `generator_read_spec` |
| **Healer** | `healer_run_tests`, `healer_debug_test`, `healer_fix_test`, `healer_inspect_page`, `browser_generate_locator` |
| **Analyzer** | `analyzer_setup`, `analyzer_import_context`, `analyzer_scan_product`, `analyzer_build_risk_profile`, `analyzer_save_profile`, `analyzer_generate_documentation` |

## AI Test Agents

A complete testing pipeline with human review gates:

```
┌─────────────────┐    ┌─────────────┐    ┌─────────────┐    ┌────────────┐
│    Analyzer     │───▶│   Planner   │───▶│  Generator  │───▶│   Healer   │
│  (risk profile) │    │ (test plan) │    │ (test code) │    │(fix tests) │
└─────────────────┘    └─────────────┘    └─────────────┘    └────────────┘
                             │                  │
                        human review       human review
```

### Example Workflow

```bash
# 1. Analyze risk (optional)
"Analyze https://myshop.com and identify high-risk areas for testing"
# → Output: risk-profiles/myshop-risk-profile.yaml

# 2. Create test plan
"Create a test plan for the checkout flow"
# → Output: test-plans/checkout-flow.md
# → REVIEW AND APPROVE

# 3. Generate tests
"Generate tests from the checkout flow test plan"
# → Output: tests/test_checkout.py

# 4. Run and heal
"Run the tests and fix any failures"
# → Auto-fixes: selectors, waits, assertions
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SELENIUM_GRID_URL` | — | Grid hub URL (enables parallel features) |
| `SELENIUM_BROWSER` | `chrome` | Browser to use (`chrome`, `firefox`, `edge`) |
| `SELENIUM_HEADLESS` | `false` | Run browser in headless mode |
| `SELENIUM_TIMEOUT` | `30000` | Default timeout in ms |
| `SE_AVOID_STATS` | — | Set to `true` to disable Selenium usage statistics |

### Local Browser (No Grid)

Works without Grid — just don't set `SELENIUM_GRID_URL`:

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "npx",
      "args": ["selenium-ai-agent"]
    }
  }
}
```

## Docker Compose

The included `docker-compose.yml` gives you a production-ready Grid:

```yaml
services:
  selenium-hub:
    image: selenium/hub:4.40.0
    ports:
      - "4444:4444"

  chrome-node:
    image: selenium/node-chrome:4.40.0
    deploy:
      replicas: 4  # 4 Chrome browsers

  firefox-node:
    image: selenium/node-firefox:4.40.0
    deploy:
      replicas: 1  # 1 Firefox browser
```

## Project Structure

```
selenium_agent/
├── selenium-mcp-server/     # TypeScript MCP server (npm: selenium-ai-agent)
│   └── src/
│       ├── server.ts        # MCP protocol handler
│       ├── context.ts       # Browser session management
│       ├── grid/            # Selenium Grid integration
│       │   ├── grid-client.ts
│       │   ├── session-pool.ts
│       │   └── exploration-coordinator.ts
│       └── tools/           # 73 tools
│           ├── navigation/
│           ├── elements/
│           ├── grid/        # Parallel execution tools
│           ├── agents/      # AI agent tools
│           └── analyzer/    # Risk analysis
│
├── selenium-grid/
│   └── docker-compose.yml   # Selenium Grid setup
├── agents/                  # Agent prompt definitions
└── docs/                    # Guides and diagrams
```

## Documentation

- [MCP Client Setup](docs/MCP_CLIENT_SETUP.md) — Claude Code, Claude Desktop, Cursor, Copilot, Cline, Windsurf
- [Agent Workflow](docs/AGENT_WORKFLOW.md) — End-to-end testing pipeline
- [Framework Standards](docs/FRAMEWORK_STANDARDS.md) — Code generation conventions
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) — Production deployment

## Contributing

Contributions welcome! Please read our contributing guidelines and submit PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT — see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Selenium](https://www.selenium.dev/) — The browser automation framework
- [Model Context Protocol](https://modelcontextprotocol.io/) — The AI agent communication standard
- [Anthropic](https://www.anthropic.com/) — For Claude and the MCP specification

---

<p align="center">
  <b>If this project helps you, please give it a star!</b><br>
  <a href="https://github.com/learn-automated-testing/selenium_agent">Star on GitHub</a>
</p>
