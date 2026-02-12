# selenium-ai-agent

Selenium MCP server for AI-driven browser automation — 69 tools including Selenium Grid parallel execution.

### One-Click Install

[![Install in VS Code](https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF)](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522selenium-mcp%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522selenium-ai-agent%2522%255D%257D) [![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5)](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522selenium-mcp%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522selenium-ai-agent%2522%255D%257D) [![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=selenium-mcp&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyJzZWxlbml1bS1haS1hZ2VudCJdfQ%3D%3D)

## Install

```bash
npm install -g selenium-ai-agent
```

Or run directly without installing:

```bash
npx selenium-ai-agent
```

## Requirements

- Node.js 18+
- Chrome browser (or Firefox/Edge)
- ChromeDriver is automatically managed by selenium-webdriver

## Quick Start

Add to your MCP client config:

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

Then ask your AI assistant: *"Navigate to https://example.com and take a screenshot"*

## Client Setup

### Claude Code

```bash
claude mcp add selenium-mcp -- npx selenium-ai-agent
```

Or add to your project `.mcp.json`:

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

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

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

Config paths per OS:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

### Cursor

Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

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

### GitHub Copilot (VS Code 1.99+)

Add to `.vscode/mcp.json`:

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

> **Note:** Copilot uses `"servers"` instead of `"mcpServers"`.

### Cline

Open the MCP Servers panel in Cline, click Configure, then Advanced MCP Settings, and add:

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

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json` (global) or `.windsurf/mcp_config.json` (project):

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

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SELENIUM_GRID_URL` | — | Grid hub URL (enables parallel features) |
| `SELENIUM_BROWSER` | `chrome` | Browser to use (`chrome`, `firefox`, `edge`) |
| `SELENIUM_HEADLESS` | `false` | Run browser in headless mode |
| `SELENIUM_TIMEOUT` | `30000` | Default timeout in ms |
| `SE_AVOID_STATS` | — | Set to `true` to disable Selenium usage statistics |

Pass env vars in your MCP config:

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "npx",
      "args": ["selenium-ai-agent"],
      "env": {
        "SELENIUM_HEADLESS": "true",
        "SE_AVOID_STATS": "true"
      }
    }
  }
}
```

## Tools (69)

**Navigation** — `navigate_to` `go_back` `go_forward` `refresh_page`

**Page Analysis** — `capture_page` `take_screenshot`

**Elements** — `click_element` `hover_element` `select_option` `drag_drop`

**Input** — `input_text` `key_press` `file_upload`

**Mouse** — `mouse_move` `mouse_click` `mouse_drag`

**Tabs** — `tab_list` `tab_select` `tab_new` `tab_close`

**Verification** — `verify_element_visible` `verify_text_visible` `verify_value` `verify_list_visible`

**Browser** — `wait_for` `execute_javascript` `resize_window` `dialog_handle` `console_logs` `network_monitor` `pdf_generate`

**Session** — `close_browser` `reset_session` `set_stealth_mode`

**Recording** — `start_recording` `stop_recording` `recording_status` `clear_recording`

**AI Agents** — `planner_setup_page` `planner_explore_page` `planner_save_plan` `generator_setup_page` `generator_read_log` `generator_write_test` `healer_run_tests` `healer_debug_test` `healer_fix_test` `browser_generate_locator`

**Analyzer** — `analyzer_setup` `analyzer_import_context` `analyzer_scan_product` `analyzer_build_risk_profile` `analyzer_save_profile` `analyzer_generate_documentation`

**Batch** — `batch_execute`

**Grid & Parallel** — `grid_status` `grid_start` `grid_stop` `grid_scale` `session_create` `session_select` `session_list` `session_destroy` `session_destroy_all` `parallel_explore` `parallel_execute` `exploration_merge` `exploration_diff` `planner_generate_plan`

## Selenium Grid

For parallel browser automation, set `SELENIUM_GRID_URL` to your Grid hub:

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

See the [project README](https://github.com/learn-automated-testing/selenium_agent#readme) for Docker Compose setup and Grid details.

## License

MIT
