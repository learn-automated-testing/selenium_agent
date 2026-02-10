# 🤖 Selenium MCP Server

[![npm version](https://img.shields.io/npm/v/selenium-ai-agent.svg)](https://www.npmjs.com/package/selenium-ai-agent)
[![PyPI version](https://img.shields.io/pypi/v/ai-agent-selenium.svg)](https://pypi.org/project/ai-agent-selenium/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Selenium Grid](https://img.shields.io/badge/Selenium%20Grid-Parallel-blue.svg)](https://www.selenium.dev/documentation/grid/)

**The first MCP server with true parallel browser automation using Selenium Grid.**

While other browser MCP servers run a single browser instance, Selenium MCP Server connects to Selenium Grid for **massive parallel exploration** — spin up 10, 20, or 100 browser sessions and explore your entire application simultaneously.

<p align="center">
  <img src="docs/selenium-agent-workflow.png" alt="Selenium Agent Workflow" width="700"/>
</p>

## ⚡ Why This Over Playwright MCP?

| Feature | Playwright MCP | Selenium MCP Server |
|---------|---------------|---------------------|
| **Parallelism** | Single browser, shared context | True parallel: Grid with unlimited nodes |
| **Scaling** | Limited by single browser | Horizontally scalable — add nodes as needed |
| **Isolation** | Shared state between clients | Full isolation per session |
| **Multi-browser** | One at a time | Chrome + Firefox + Edge simultaneously |
| **Infrastructure** | Simple | Docker Compose ready |
| **AI Agent workflows** | Basic | Planner → Generator → Healer pipeline |

**Perfect for:** AI agents that need to explore large applications fast, cross-browser testing, and enterprise automation at scale.

## 🚀 Quick Start

### 1. Install

```bash
# npm (recommended)
npm install -g selenium-ai-agent

# or pip
pip install ai-agent-selenium
```

### 2. Start Selenium Grid

```bash
# Clone and start the Grid
git clone https://github.com/learn-automated-testing/selenium_agent.git
cd selenium_agent
docker-compose up -d

# Verify Grid is running
open http://localhost:4444  # Grid console
```

### 3. Configure Your MCP Client

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "selenium": {
      "command": "npx",
      "args": ["selenium-ai-agent"],
      "env": {
        "SELENIUM_GRID_URL": "http://localhost:4444"
      }
    }
  }
}
```

### 4. Try It!

```
"Explore the e-commerce site at https://practiceautomatedtesting.com in parallel — 
check the homepage, products, cart, and checkout sections simultaneously"
```

The agent will spin up 4 browser sessions on your Grid and explore all sections at once.

## 🔥 Killer Feature: Parallel Exploration

Explore your entire application in seconds, not minutes:

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

**Grid Status:**
```
Grid Status: READY
Capacity: 0/5 slots used (5 available)

Nodes (5):
  - chrome-node-1 | UP | 0/1 sessions | chrome 144.0
  - chrome-node-2 | UP | 0/1 sessions | chrome 144.0
  - chrome-node-3 | UP | 0/1 sessions | chrome 144.0
  - chrome-node-4 | UP | 0/1 sessions | chrome 144.0
  - firefox-node  | UP | 0/1 sessions | firefox 147.0
```

## 🛠️ 70+ Tools Organized by Category

### Grid & Parallel Execution (NEW!)
| Tool | Description |
|------|-------------|
| `grid_status` | Check Grid health, nodes, and capacity |
| `session_create` | Create browser session on Grid |
| `session_select` | Switch active session |
| `session_list` | List all Grid sessions |
| `session_destroy` | Clean up a session |
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

### Verification
`verify_element_visible` · `verify_text_visible` · `verify_value` · `verify_list_visible`

### Browser Management
`wait_for` · `execute_javascript` · `dialog_handle` · `console_logs` · `network_monitor` · `resize_window`

### Tabs
`tab_list` · `tab_select` · `tab_new` · `tab_close`

### Recording & Generation
`start_recording` · `stop_recording` · `recording_status` · `generate_script`

### AI Agent Tools
| Agent | Tools |
|-------|-------|
| **Planner** | `planner_setup_page`, `planner_explore_page`, `planner_save_plan` |
| **Generator** | `generator_setup_page`, `generator_read_log`, `generator_write_test` |
| **Healer** | `healer_run_tests`, `healer_debug_test`, `healer_fix_test` |
| **Analyzer** | `analyzer_setup`, `analyzer_scan_product`, `analyzer_build_risk_profile` |

## 🤖 AI Test Agents

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
→ Output: risk-profiles/myshop-risk-profile.yaml

# 2. Create test plan
"Create a test plan for the checkout flow"
→ Output: test-plans/checkout-flow.md
→ REVIEW AND APPROVE

# 3. Generate tests
"Generate pytest tests from the checkout flow test plan"
→ Output: tests/test_checkout.py

# 4. Run and heal
"Run the tests and fix any failures"
→ Auto-fixes: selectors, waits, assertions
```

## 📁 Project Structure

```
selenium_agent/
├── selenium-mcp-server/     # TypeScript MCP server
│   └── src/
│       ├── server.ts        # MCP protocol handler
│       ├── context.ts       # Browser session management
│       ├── grid/            # Selenium Grid integration
│       │   ├── grid-client.ts
│       │   ├── session-pool.ts
│       │   └── exploration-coordinator.ts
│       └── tools/           # 70+ tools
│           ├── navigation/
│           ├── elements/
│           ├── grid/        # Parallel execution tools
│           ├── agents/      # AI agent tools
│           └── analyzer/    # Risk analysis
│
├── docker-compose.yml       # Selenium Grid setup
├── agents/                  # Agent prompt definitions
└── docs/                    # Guides and diagrams
```

## 🐳 Docker Compose

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

**Scale up anytime:**
```bash
docker-compose up -d --scale chrome-node=10
```

## 📖 Documentation

- [Installation Guide](docs/INSTALLATION_GUIDE.md) — All installation options
- [MCP Client Setup](docs/MCP_CLIENT_SETUP.md) — Claude Desktop, Cursor, Cline, Continue.dev
- [Agent Workflow](docs/AGENT_WORKFLOW.md) — End-to-end testing pipeline
- [Framework Standards](docs/FRAMEWORK_STANDARDS.md) — Code generation conventions
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) — Production deployment

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SELENIUM_GRID_URL` | — | Grid hub URL (enables parallel features) |
| `SELENIUM_BROWSER` | `chrome` | Default browser |
| `SELENIUM_HEADLESS` | `false` | Run headless |
| `SELENIUM_TIMEOUT` | `30000` | Default timeout (ms) |

### Local Browser (No Grid)

Works without Grid too — just don't set `SELENIUM_GRID_URL`:

```json
{
  "mcpServers": {
    "selenium": {
      "command": "npx",
      "args": ["selenium-ai-agent"]
    }
  }
}
```

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines and submit PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Selenium](https://www.selenium.dev/) — The browser automation framework
- [Model Context Protocol](https://modelcontextprotocol.io/) — The AI agent communication standard
- [Anthropic](https://www.anthropic.com/) — For Claude and the MCP specification

---

<p align="center">
  <b>If this project helps you, please give it a ⭐!</b><br>
  <a href="https://github.com/learn-automated-testing/selenium_agent">Star on GitHub</a>
</p>
