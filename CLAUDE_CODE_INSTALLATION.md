# Installing Selenium MCP Server with Claude Code

This guide walks you through setting up the Selenium MCP Server to work with Claude Code, enabling AI-powered browser automation and test generation capabilities.

## Prerequisites

Before starting, ensure you have:
- **Python 3.8+** installed on your system
- **Chrome browser** installed
- **Claude Code** installed ([Download from Anthropic](https://www.anthropic.com/claude-code))
- **Git** for cloning the repository (optional)

## Step 1: Download the Selenium MCP Server

Choose one of these methods:

### Option A: Clone from GitHub
```bash
git clone https://github.com/yourusername/selenium-mcp-server.git
cd selenium-mcp-server
```

### Option B: Download ZIP
Download the project as a ZIP file and extract it to your preferred location.

## Step 2: Run the Automatic Installer

The easiest way to install is using the automatic installer:

```bash
python3 install.py
```

The installer will:
- Create a Python virtual environment
- Install all required dependencies
- Detect your system configuration
- Configure Claude Desktop automatically
- Generate Cursor configuration (if you use Cursor)
- Test the installation

**That's it!** The automatic installer handles everything for you.

## Step 3: Configure Claude Code

After installation, you need to add the MCP server to Claude Code's configuration.

### Finding Your Configuration File

Claude Code uses a configuration file located at:
- **macOS**: `~/.claude/claude_code.json`
- **Windows**: `%USERPROFILE%\.claude\claude_code.json`
- **Linux**: `~/.claude/claude_code.json`

### Adding the MCP Server

Open your `claude_code.json` file and add the Selenium MCP Server configuration:

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "/absolute/path/to/selenium-mcp-server/venv/bin/python",
      "args": [
        "/absolute/path/to/selenium-mcp-server/mcp_server.py"
      ],
      "cwd": "/absolute/path/to/selenium-mcp-server"
    }
  }
}
```

**Important**: Replace `/absolute/path/to/selenium-mcp-server` with the actual full path to where you cloned/downloaded the project.

### Path Examples

**macOS/Linux example**:
```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "/Users/yourname/selenium-mcp-server/venv/bin/python",
      "args": [
        "/Users/yourname/selenium-mcp-server/mcp_server.py"
      ],
      "cwd": "/Users/yourname/selenium-mcp-server"
    }
  }
}
```

**Windows example**:
```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "C:/Users/yourname/selenium-mcp-server/venv/Scripts/python.exe",
      "args": [
        "C:/Users/yourname/selenium-mcp-server/mcp_server.py"
      ],
      "cwd": "C:/Users/yourname/selenium-mcp-server"
    }
  }
}
```

**Note for Windows users**: Use forward slashes (/) or double backslashes (\\\\) in JSON configuration files.

## Step 4: Restart Claude Code

After saving the configuration file:
1. Completely quit Claude Code
2. Restart Claude Code
3. Open a new conversation

## Step 5: Verify Installation

To verify the installation is working, start a conversation in Claude Code and ask:

```
"List the available MCP tools"
```

You should see 40+ Selenium tools including:
- `navigate_to`
- `capture_page`
- `click_element`
- `input_text`
- `planner_setup_page`
- `generator_setup_page`
- `healer_run_tests`
- And many more...

### Quick Test

Try this simple command in Claude Code:

```
"Navigate to example.com and take a screenshot"
```

If the browser opens and a screenshot is taken, everything is working correctly!

## Alternative: Manual Installation

If the automatic installer doesn't work or you prefer manual setup:

### 1. Create Virtual Environment

```bash
cd selenium-mcp-server
python3 -m venv venv
```

### 2. Activate Virtual Environment

**macOS/Linux**:
```bash
source venv/bin/activate
```

**Windows**:
```bash
venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Test Installation

```bash
python3 test_mcp_direct.py
```

You should see: "All tests passed! MCP server is ready for use."

### 5. Configure Claude Code

Follow Step 3 above to add the server to Claude Code's configuration.

## Using the AI Test Agents

The Selenium MCP Server includes three powerful AI agents for automated testing:

### 1. Planner Agent - Create Test Plans

Ask Claude Code:
```
"Use the selenium-test-planner agent to create a test plan for the login feature at https://example.com"
```

The agent will:
- Explore the application
- Identify test scenarios
- Create a comprehensive test plan
- Save it as a markdown file

### 2. Generator Agent - Generate Test Code

Ask Claude Code:
```
"Use the selenium-test-generator agent to create pytest tests from the login test plan"
```

The agent will:
- Read the test plan
- Execute steps in a real browser
- Generate clean, executable test code
- Support pytest, unittest, and Robot Framework

### 3. Healer Agent - Fix Failing Tests

Ask Claude Code:
```
"Use the selenium-test-healer agent to fix the failing tests in tests/test_login.py"
```

The agent will:
- Run your tests
- Debug failures
- Fix broken selectors, waits, and assertions
- Verify the fixes work

## Common Use Cases

### Browser Automation
```
"Navigate to github.com, search for 'selenium', and show me the first 5 results"
```

### Test Recording
```
"Start recording, navigate to example.com/login, enter username 'test',
enter password 'pass123', click login, stop recording, and generate a pytest script"
```

### Complete Test Workflow
```
1. "Create a test plan for the checkout flow at https://myshop.com"
2. "Generate pytest tests from the checkout test plan"
3. "Run the tests and fix any failures"
```

## Troubleshooting

### MCP Server Not Showing Up

1. **Check the configuration file path**:
   - Ensure `claude_code.json` is in the correct location
   - Verify the file has valid JSON syntax

2. **Check absolute paths**:
   - All paths must be absolute (full paths), not relative
   - Use `pwd` (macOS/Linux) or `cd` (Windows) to get the full path

3. **Check Python path**:
   - The command should point to the Python executable inside `venv/bin/` or `venv/Scripts/`
   - Test it: `/path/to/venv/bin/python --version`

### Chrome Driver Issues (macOS)

If Chrome fails to start on macOS:
```bash
xattr -cr ~/.wdm/drivers/chromedriver/
```

This removes the quarantine attribute that macOS adds to downloaded executables.

### Browser Session Stuck

If the automation browser gets stuck or won't close:

Ask Claude Code:
```
"Use the reset_automation_session tool"
```

This will safely close all automation browser instances without affecting your personal Chrome browser.

### View Logs

Check the server logs for detailed error information:
```bash
tail -f /path/to/selenium-mcp-server/mcp_server.log
```

### Test the Server Manually

Run the server directly to see if there are any errors:
```bash
cd /path/to/selenium-mcp-server
source venv/bin/activate  # or venv\Scripts\activate on Windows
python mcp_server.py
```

Press Ctrl+C to stop it. If you see errors, they'll help diagnose the issue.

## Advanced Configuration

### Using with Multiple MCP Servers

If you have other MCP servers, your configuration will look like this:

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "/path/to/selenium-mcp-server/venv/bin/python",
      "args": ["/path/to/selenium-mcp-server/mcp_server.py"],
      "cwd": "/path/to/selenium-mcp-server"
    },
    "other-mcp-server": {
      "command": "/path/to/other-server/venv/bin/python",
      "args": ["/path/to/other-server/server.py"]
    }
  }
}
```

### Environment Variables

You can set environment variables in the configuration:

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "/path/to/venv/bin/python",
      "args": ["/path/to/mcp_server.py"],
      "cwd": "/path/to/selenium-mcp-server",
      "env": {
        "SELENIUM_HEADLESS": "true",
        "LOG_LEVEL": "DEBUG"
      }
    }
  }
}
```

### Running in Headless Mode

To run Chrome in headless mode (no visible browser window), set the environment variable:

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "/path/to/venv/bin/python",
      "args": ["/path/to/mcp_server.py"],
      "env": {
        "HEADLESS": "true"
      }
    }
  }
}
```

## Next Steps

Now that you have Claude Code working with the Selenium MCP Server, you can:

1. **Explore the capabilities**: Ask Claude Code "What can you do with Selenium MCP?"
2. **Try the agents**: Create a test plan, generate tests, and fix failures automatically
3. **Automate workflows**: Use Claude Code to automate repetitive browser tasks
4. **Generate test suites**: Have AI create comprehensive test coverage for your applications

## Getting Help

If you encounter issues:

1. **Check the logs**: `selenium-mcp-server/mcp_server.log`
2. **Run tests**: `python3 test_mcp_direct.py`
3. **Verify configuration**: Ensure all paths are absolute and correct
4. **Restart Claude Code**: Always restart after configuration changes

## Resources

- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [Selenium Documentation](https://www.selenium.dev/documentation/)

---

**Congratulations!** You now have AI-powered browser automation at your fingertips through Claude Code. Start automating, testing, and exploring the web with natural language commands.
