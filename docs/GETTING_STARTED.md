# Getting Started with Selenium MCP Server

This guide will get you up and running with Selenium MCP Server in under 5 minutes.

## Prerequisites

- **Node.js** 18+ or **Python** 3.8+
- **Docker** (for Selenium Grid)
- **Chrome** browser
- An MCP-compatible client (Claude Desktop, Cursor, Cline, etc.)

## Option 1: Quick Start with Local Browser

If you just want to try it out without Grid (single browser):

### 1. Install

```bash
npm install -g selenium-ai-agent
```

### 2. Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

### 3. Restart Claude Desktop and Test

Try saying:
```
Navigate to https://example.com and take a screenshot
```

---

## Option 2: Full Setup with Selenium Grid (Recommended)

Get the full power of parallel browser automation:

### 1. Clone and Start Grid

```bash
git clone https://github.com/learn-automated-testing/selenium_agent.git
cd selenium_agent
docker-compose up -d
```

Verify at http://localhost:4444 — you should see 4 Chrome nodes and 1 Firefox node.

### 2. Install the MCP Server

```bash
npm install -g selenium-ai-agent
```

### 3. Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

### 4. Restart Claude Desktop and Test

Try the killer feature — parallel exploration:
```
Explore https://practiceautomatedtesting.com in parallel:
- Homepage
- Products page
- Shopping cart
- Contact page

Use 4 browser sessions simultaneously.
```

---

## First Commands to Try

### Check Grid Status
```
What's the status of my Selenium Grid?
```

### Simple Navigation
```
Navigate to https://news.ycombinator.com and capture the page
```

### Click and Interact
```
Go to https://practiceautomatedtesting.com, click on "Products", 
and add the first item to cart
```

### Parallel Exploration
```
Explore the site at https://practiceautomatedtesting.com
Cover all main sections in parallel
```

### Generate Test Code
```
Navigate through the checkout flow on https://practiceautomatedtesting.com
and generate pytest test code for it
```

---

## Scaling the Grid

Need more browsers? Scale up:

```bash
# 10 Chrome browsers
docker-compose up -d --scale chrome-node=10

# 20 Chrome + 5 Firefox
docker-compose up -d --scale chrome-node=20 --scale firefox-node=5
```

---

## Troubleshooting

### "Grid not available"
- Check Docker is running: `docker ps`
- Verify Grid is up: http://localhost:4444
- Check environment variable is set correctly

### Browser won't start
- On macOS, clear quarantine: `xattr -cr ~/.wdm/drivers/`
- Install Chrome if missing

### Connection timeout
- Increase timeout: `SELENIUM_TIMEOUT=60000`
- Check Grid has available capacity

---

## Next Steps

- Read the [Agent Workflow Guide](docs/AGENT_WORKFLOW.md) for the complete testing pipeline
- Check out [example test plans](test-plans/) to see what the Planner generates
- Explore [domain templates](domain_templates/) for risk-based testing

---

## Getting Help

- 📖 [Full Documentation](README.md)
- 🐛 [Report Issues](https://github.com/learn-automated-testing/selenium_agent/issues)
- 💬 [Discussions](https://github.com/learn-automated-testing/selenium_agent/discussions)
