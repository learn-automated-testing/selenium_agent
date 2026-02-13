# MCP Client Setup Guide

How to configure `selenium-ai-agent` with every major MCP client.

---

## Installation

```bash
# Install globally
npm install -g selenium-ai-agent

# Or use npx (no install needed)
npx selenium-ai-agent
```

Requirements: Node.js 18+, Chrome browser.

---

## Claude Code

### CLI (recommended)

```bash
claude mcp add selenium-mcp -- npx selenium-ai-agent
```

With environment variables:

```bash
claude mcp add selenium-mcp -- npx selenium-ai-agent \
  -e SELENIUM_HEADLESS=true \
  -e SE_AVOID_STATS=true
```

### Project config (`.mcp.json`)

Create `.mcp.json` in your project root:

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

---

## Claude Desktop

### Config file location

| OS | Path |
|----|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

### Configuration

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

### Steps

1. Quit Claude Desktop completely
2. Open the config file (create if it doesn't exist)
3. Add the configuration above
4. Save and restart Claude Desktop
5. Look for the hammer icon in the input area

---

## Cursor

### Config file location

| Scope | Path |
|-------|------|
| Project | `.cursor/mcp.json` |
| Global | `~/.cursor/mcp.json` |

### Configuration

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

### Alternative: Settings UI

1. Open Settings (Cmd/Ctrl + ,)
2. Search for "MCP"
3. Click "Add new MCP server"
4. Add the configuration
5. Restart Cursor

---

## GitHub Copilot (VS Code 1.99+)

### Config file

`.vscode/mcp.json` in your project:

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

> **Important:** Copilot uses `"servers"` — not `"mcpServers"`.

---

## Cline

### Steps

1. Click the MCP Servers icon in the Cline panel
2. Click **Configure** → **Advanced MCP Settings**
3. Add the configuration:

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

4. Save and reload Cline

---

## Windsurf

### Config file location

| Scope | Path |
|-------|------|
| Global | `~/.codeium/windsurf/mcp_config.json` |
| Project | `.windsurf/mcp_config.json` |

### Configuration

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

---

## With Selenium Grid

To enable parallel browser automation, add `SELENIUM_GRID_URL` to any config:

### Claude Code

```bash
claude mcp add selenium-mcp -- npx selenium-ai-agent \
  -e SELENIUM_GRID_URL=http://localhost:4444
```

### All other clients

Add an `env` block to the config:

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

For GitHub Copilot, use `"servers"` instead of `"mcpServers"` and add `"type": "stdio"`.

### Start the Grid

```bash
git clone https://github.com/learn-automated-testing/selenium_agent.git
cd selenium_agent
docker-compose up -d
```

Verify at http://localhost:4444.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SELENIUM_GRID_URL` | — | Grid hub URL (enables parallel features) |
| `SELENIUM_BROWSER` | `chrome` | Browser (`chrome`, `firefox`, `edge`) |
| `SELENIUM_HEADLESS` | `false` | Run headless |
| `SELENIUM_TIMEOUT` | `30000` | Default timeout in ms |
| `SE_AVOID_STATS` | — | Set to `true` to disable Selenium usage statistics |

Example with environment variables:

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "npx",
      "args": ["selenium-ai-agent"],
      "env": {
        "SELENIUM_GRID_URL": "http://localhost:4444",
        "SELENIUM_HEADLESS": "true",
        "SE_AVOID_STATS": "true"
      }
    }
  }
}
```

---

## Verification

After setup, test with this prompt:

```
Navigate to https://example.com and take a screenshot
```

You should see the server navigate to the page and return a screenshot.

---

## Troubleshooting

### "npx: command not found"

Install Node.js 18+ from https://nodejs.org/. Verify with:

```bash
node --version  # Should be 18+
npx --version
```

### MCP server not showing in client

1. **Check JSON syntax** — validate at https://jsonlint.com/
2. **Check file location** — make sure the config is in the right path for your OS
3. **Restart the client** — fully quit and reopen
4. **Check Node.js is in PATH** — some clients need the full path to `npx`:

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "/usr/local/bin/npx",
      "args": ["selenium-ai-agent"]
    }
  }
}
```

Find your npx path: `which npx` (macOS/Linux) or `where npx` (Windows).

### Chrome not found

Install Chrome or set a different browser:

```json
{
  "env": {
    "SELENIUM_BROWSER": "firefox"
  }
}
```

### Permission errors on macOS

If Chrome is blocked by macOS security:

1. Open System Settings → Privacy & Security
2. Allow Chrome to run
3. Or run headless: set `SELENIUM_HEADLESS=true`

---

## Additional Resources

- [README](../README.md) — Project overview, Grid setup, full tool list
- [Agent Workflow](AGENT_WORKFLOW.md) — Planner → Generator → Healer pipeline
- [Framework Standards](FRAMEWORK_STANDARDS.md) — Code generation conventions

For issues: https://github.com/learn-automated-testing/selenium_agent/issues
