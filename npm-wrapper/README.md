# Selenium MCP Server (Node.js Wrapper)

Node.js launcher for the **Selenium MCP Server** - AI-powered browser automation with test agents (Planner, Generator, Healer).

This package provides a convenient way to use the Python-based Selenium MCP Server in Node.js/JavaScript projects.

## 🚀 Quick Start

### Installation

```bash
npm install selenium-mcp-server
# or
yarn add selenium-mcp-server
# or
pnpm add selenium-mcp-server
```

**Note:** This package requires Python 3.10+ to be installed on your system. The Python package will be automatically installed during `npm install`.

### Run the Server

```bash
npx selenium-mcp
```

Or add to your `package.json`:

```json
{
  "scripts": {
    "mcp": "selenium-mcp"
  }
}
```

Then run:

```bash
npm run mcp
```

## 📋 MCP Client Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "npx",
      "args": ["selenium-mcp-server"]
    }
  }
}
```

### Cursor

In Cursor Settings → MCP:

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "npx",
      "args": ["selenium-mcp-server"]
    }
  }
}
```

### Cline / Other MCP Clients

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "npx",
      "args": ["selenium-mcp-server"]
    }
  }
}
```

## 💻 Programmatic Usage

You can also use this package programmatically in your Node.js code:

```javascript
import { startServer } from 'selenium-mcp-server';

// Start the server
const server = startServer({
  args: [],        // Additional arguments
  stdio: true      // Inherit stdio
});

server.on('close', (code) => {
  console.log('Server exited with code', code);
});

// Handle termination
process.on('SIGINT', () => {
  server.kill('SIGINT');
});
```

### Get Version

```javascript
import { getVersion } from 'selenium-mcp-server';

const version = await getVersion();
console.log('Selenium MCP Server version:', version);
```

## 🤖 AI Test Agents

The Selenium MCP Server includes three AI-powered agents:

### 🟢 Planner Agent
Creates comprehensive test plans by exploring your web application.

**Example:**
```
Ask Claude: "Use the planner agent to create a test plan for the login feature at example.com"
```

### 🔵 Generator Agent
Transforms test plans into executable Selenium test code (pytest, Robot Framework, unittest).

**Example:**
```
Ask Claude: "Use the generator agent to create pytest tests from the login test plan"
```

### 🔴 Healer Agent
Debugs and automatically fixes failing Selenium tests.

**Example:**
```
Ask Claude: "Use the healer agent to fix failing tests in tests/test_login.py"
```

## 🛠️ Available Tools

The server provides 46 tools including:

- **Navigation:** `navigate_to`, `go_back`, `go_forward`
- **Element Interaction:** `click_element`, `hover_element`, `input_text`, `select_option`
- **Mouse Operations:** `mouse_move_xy`, `mouse_click_xy`, `mouse_drag_xy`
- **Keyboard:** `press_key`
- **Verification:** `browser_verify_element_visible`, `browser_verify_text_visible`, `browser_verify_value`
- **Tab Management:** `list_tabs`, `switch_to_tab`, `open_new_tab`, `close_tab`
- **JavaScript:** `evaluate_js`
- **Screenshots:** `take_screenshot`, `capture_page`
- **Agent Tools:** `planner_setup_page`, `generator_write_test`, `healer_run_tests`, and more

## 📦 Requirements

- **Node.js:** 16.0.0 or higher
- **Python:** 3.10 or higher (automatically detected and used)

## 🐛 Troubleshooting

### Python Not Found

If you see "Python not found" errors:

1. Install Python 3.10+:
   - **macOS:** `brew install python3`
   - **Ubuntu/Debian:** `sudo apt install python3`
   - **Windows:** `winget install Python.Python.3.12`
   - **Or download from:** https://www.python.org/downloads/

2. Verify installation:
   ```bash
   python3 --version
   ```

3. Reinstall the package:
   ```bash
   npm install selenium-mcp-server
   ```

### Manual Python Package Installation

If automatic installation fails:

```bash
pip install selenium-mcp-server
```

Then try running the server again.

### Chrome/ChromeDriver Issues (macOS)

If Chrome fails to start:

```bash
xattr -cr ~/.wdm/drivers/chromedriver/
```

## 📚 Documentation

- **Full Documentation:** https://github.com/yourusername/selenium-mcp-server
- **MCP Protocol:** https://modelcontextprotocol.io
- **FastMCP:** https://gofastmcp.com

## 🤝 Contributing

Contributions are welcome! Please see the main repository for contribution guidelines.

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Links

- **Repository:** https://github.com/yourusername/selenium-mcp-server
- **Issues:** https://github.com/yourusername/selenium-mcp-server/issues
- **PyPI Package:** https://pypi.org/project/selenium-mcp-server/

## 💡 How It Works

This npm package is a lightweight wrapper that:

1. Detects your Python installation
2. Automatically installs the Python `selenium-mcp-server` package
3. Launches the Python server when you run `npx selenium-mcp`
4. Provides a Node.js API for programmatic usage

The actual browser automation logic runs in Python using Selenium, which provides:
- More mature Selenium ecosystem
- Better test framework support
- Easier maintenance of a single codebase

The MCP protocol ensures seamless communication between your Node.js application and the Python server.
