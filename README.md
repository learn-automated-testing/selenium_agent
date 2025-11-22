# Selenium MCP Server

A Model Context Protocol (MCP) server that provides browser automation capabilities using Selenium WebDriver. This server offers 40+ comprehensive tools for web automation, testing, and interaction, plus **AI-powered test agents** for automated test planning, generation, and healing.

## Features

- **🤖 AI Test Agents** - Planner, Generator, and Healer agents for automated testing workflows
- **40+ Browser Automation Tools** covering all aspects of web interaction
- **Pure MCP Protocol Implementation** - compatible with MCP clients
- **Selenium WebDriver Backend** with automatic driver management
- **Multi-Framework Code Generation** - pytest, Robot Framework, unittest
- **Element-based Interactions** using DOM snapshots and references
- **Verification & Assertions** - Built-in tools for test validation
- **Self-Healing Tests** - Automatically fix failing tests with the Healer agent
- **Cross-Platform Support** - Works with any Selenium-compatible automation framework

## Quick Start

### Installation

**Option 1: Install from PyPI (Recommended for Users)**
```bash
pip install selenium-mcp-server
```

**Option 2: Install from Source (Development)**
```bash
# Clone the repository
git clone https://github.com/yourusername/selenium-mcp-server.git
cd selenium-mcp-server

# Install in development mode
pip install -e .

# Or install with Robot Framework support
pip install -e ".[robot]"

# Or install with all optional dependencies
pip install -e ".[all]"
```

**Option 3: Install from GitHub (Latest)**
```bash
pip install git+https://github.com/yourusername/selenium-mcp-server.git
```

**Option 4: Install via npm (Node.js Projects)**

For Node.js/JavaScript developers:
```bash
npm install selenium-mcp-server
# Then run with:
npx selenium-mcp
```

See the [npm wrapper documentation](npm-wrapper/README.md) for Node.js-specific usage.

### Running the Server

**Via command-line (after installation):**
```bash
selenium-mcp
```

**Or directly with Python:**
```bash
python mcp_server.py
```

**Or with uvx (no installation needed):**
```bash
uvx selenium-mcp-server
```

### Configure in Claude Desktop / Cursor

Add to your MCP client configuration:

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "selenium-mcp"
    }
  }
}
```

**Cursor** (Settings → MCP):
```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "selenium-mcp"
    }
  }
}
```

**Or use with full Python path:**
```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "python",
      "args": ["-m", "mcp_server"]
    }
  }
}
```

## Available Tools

### Navigation (3 tools)
- `navigate_to` - Navigate to a URL
- `go_back` - Go back to previous page  
- `go_forward` - Go forward to next page

### Page Analysis (1 tool)
- `capture_page` - Capture DOM snapshot for element analysis

### Element Interactions (4 tools)
- `click_element` - Click elements using page references
- `hover_element` - Hover over elements
- `select_option` - Select dropdown options
- `input_text` - Type text into input fields

### Mouse Operations (3 tools)
- `mouse_move_xy` - Move mouse to coordinates
- `mouse_click_xy` - Click at coordinates
- `mouse_drag_xy` - Drag between coordinates

### Keyboard Operations (1 tool)
- `press_key` - Press keyboard keys (Enter, Tab, arrows, etc.)

### Tab Management (4 tools)
- `list_tabs` - List all browser tabs
- `switch_to_tab` - Switch between tabs
- `open_new_tab` - Open new tabs
- `close_tab` - Close tabs

### JavaScript & Advanced (8 tools)
- `evaluate_js` - Execute JavaScript code
- `handle_dialog` - Handle alerts/confirms/prompts
- `drag_and_drop` - Drag elements between locations
- `upload_file` - Upload files through input elements
- `get_console_messages` - Monitor console logs
- `get_network_requests` - Monitor network activity
- `save_as_pdf` - Generate PDF of current page
- `wait_for_element` - Wait for element conditions

### Browser Management (3 tools)
- `take_screenshot` - Capture page screenshots
- `set_window_size` - Resize browser window
- `close_session` - Close browser session

## MCP Protocol

The server implements the MCP protocol via JSON-RPC over stdin/stdout:

```json
{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}
{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "navigate_to", "arguments": {"url": "https://example.com"}}}
```

## Architecture

- **Context Management** - Handles browser sessions and page state
- **Tool-based Design** - Each capability is a discrete, callable tool
- **Element References** - Uses DOM snapshots with element references for interactions
- **Lazy Initialization** - Browser starts only when needed
- **Robust Error Handling** - Graceful fallbacks and error reporting

---

# Selenium Test Agents

The Selenium MCP Server now includes **AI-powered test agents** modeled after Playwright's agent architecture. These specialized agents help you create test plans, generate test code, and fix failing tests automatically.

## Available Agents

### 🟢 Planner Agent (`selenium-test-planner`)
**Purpose**: Explore web applications and create comprehensive test plans

**What it does**:
- Navigates through your application to understand workflows
- Identifies critical user journeys and edge cases
- Creates detailed, step-by-step test plans in markdown format
- Organizes scenarios with prerequisites, steps, and expected results

**Key Tools**:
- `planner_setup_page` - Initialize planning session
- `planner_save_plan` - Save test plan to markdown file
- All browser navigation and interaction tools

**Usage Example**:
```markdown
Ask your AI: "Use the planner agent to create a test plan for the login feature at https://example.com"

The agent will:
1. Navigate and explore the login page
2. Identify test scenarios (valid login, invalid credentials, password reset, etc.)
3. Create a comprehensive test plan document
4. Save it to test-plans/login-feature.plan.md
```

### 🔵 Generator Agent (`selenium-test-generator`)
**Purpose**: Transform test plans into executable Selenium test code

**What it does**:
- Reads test plans and understands requirements
- Executes each test step in a real browser to validate interactions
- Records all actions and generates reliable test code
- Supports pytest, unittest, and Robot Framework

**Key Tools**:
- `generator_setup_page` - Initialize test generation session
- `generator_read_log` - Get recorded action history
- `generator_write_test` - Save generated test code
- Verification tools for assertions

**Usage Example**:
```markdown
Ask your AI: "Use the generator agent to create pytest tests from the login test plan"

The agent will:
1. Read the test plan
2. Execute each step in real browser
3. Record successful interactions
4. Generate clean, maintainable pytest code
5. Save to tests/test_login.py
```

**Generated Test Example**:
```python
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class TestLogin:
    @pytest.fixture
    def driver(self):
        driver = webdriver.Chrome()
        yield driver
        driver.quit()

    def test_valid_login(self, driver):
        """Test successful login with valid credentials"""
        driver.get("https://example.com/login")

        # Enter username
        username_field = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "username"))
        )
        username_field.send_keys("testuser")

        # Enter password
        driver.find_element(By.ID, "password").send_keys("password123")

        # Click login button
        driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()

        # Verify successful login
        assert WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.XPATH, "//div[@class='welcome']"))
        )
```

### 🔴 Healer Agent (`selenium-test-healer`)
**Purpose**: Debug and fix failing Selenium tests automatically

**What it does**:
- Runs your test suite and identifies failures
- Debugs each failing test with enhanced logging
- Investigates root causes (selector issues, timing, data problems)
- Applies fixes to make tests reliable
- Re-runs tests to verify fixes work

**Key Tools**:
- `healer_run_tests` - Execute test suite
- `healer_debug_test` - Debug specific failing test
- `healer_fix_test` - Apply fixes to test code
- `browser_generate_locator` - Find better selectors

**Common Fixes**:
- Updates brittle selectors (XPath → CSS → ID)
- Adds proper wait conditions
- Handles stale element references
- Fixes timing and race conditions
- Updates assertions for changed application behavior

**Usage Example**:
```markdown
Ask your AI: "Use the healer agent to fix failing tests in tests/test_login.py"

The agent will:
1. Run all tests and collect failures
2. Debug each failure individually
3. Identify root causes (e.g., selector changed, timing issue)
4. Apply appropriate fixes
5. Verify tests now pass
6. Create backups of original files
```

## Agent Workflow: End-to-End Test Automation

### Complete Workflow Example
```markdown
# Step 1: Create Test Plan
"Use the planner agent to create a comprehensive test plan for the e-commerce
checkout flow at https://myshop.com, covering product selection, cart management,
and payment processing"

→ Output: test-plans/checkout-flow.plan.md

# Step 2: Generate Tests
"Use the generator agent to create pytest tests from the checkout flow test plan"

→ Output: tests/test_checkout.py

# Step 3: Run and Fix
"Run the checkout tests. If any fail, use the healer agent to fix them"

→ Output: Fixed tests with proper waits, selectors, and assertions
```

## Agent-Specific Tools

### Planner Tools
- `planner_setup_page(url, feature)` - Initialize planning session
- `planner_save_plan(plan_content, filename)` - Save test plan

### Generator Tools
- `generator_setup_page(url, test_plan)` - Start test generation
- `generator_read_log()` - Get recorded actions
- `generator_write_test(test_code, filename, framework)` - Save test code

### Healer Tools
- `healer_run_tests(test_path, framework)` - Execute tests
- `healer_debug_test(test_name, test_path)` - Debug specific test
- `healer_fix_test(test_path, fixed_code, fix_description)` - Apply fix

### Verification Tools (for all agents)
- `browser_verify_element_visible(element, ref)` - Check element visibility
- `browser_verify_text_visible(text)` - Verify text on page
- `browser_verify_value(element, ref, expected_value)` - Check input values
- `browser_verify_list_visible(items)` - Verify multiple items

## How to Use Agents

### With Claude Code or Compatible AI Clients

Simply describe what you want the agent to do:

```markdown
# For Planning
"Create a test plan for the user registration feature"
"Plan tests for the shopping cart functionality at https://shop.example.com"

# For Test Generation
"Generate pytest tests from the registration test plan"
"Create Robot Framework tests for the login scenarios"

# For Healing/Fixing
"Fix the failing tests in tests/test_checkout.py"
"Debug why test_user_login is failing and fix it"
```

The AI will automatically:
1. Select the appropriate agent
2. Use the right tools in the correct sequence
3. Provide you with the results

### Agent Configuration Files

Agent definitions are located in `/agents/`:
- `selenium-test-planner.agent.md` - Planner configuration
- `selenium-test-generator.agent.md` - Generator configuration
- `selenium-test-healer.agent.md` - Healer configuration

These files define:
- Agent purpose and model
- Available tools
- Instructions and methodology
- Best practices

## Benefits of Using Agents

✅ **Faster Test Creation** - Agents explore, plan, and generate tests automatically
✅ **Higher Quality** - Tests follow best practices with proper waits and selectors
✅ **Self-Healing** - Automatically fix failing tests instead of manual debugging
✅ **Comprehensive Coverage** - Planner identifies edge cases you might miss
✅ **Maintainable Code** - Generated code is clean, documented, and follows patterns
✅ **Multi-Framework** - Generate tests for pytest, unittest, or Robot Framework

---

# Installation Guide - Selenium MCP Server

## Automatic Installation (Recommended)

### Prerequisites
- Python 3.8 or newer
- Chrome browser installed

### Quick Install

1. **Download or clone the project**:
   ```bash
   git clone <your-repo-url>
   cd selenium-mcp-server
   ```

2. **Run the automatic installer**:
   ```bash
   python3 install.py
   ```

The installer will:
- Create a virtual environment
- Install all dependencies  
- Configure MCP settings for Claude Desktop
- Create Cursor configuration file
- Test the installation

That's it! Your MCP server is ready to use.

## Manual Installation

If you prefer manual setup:

### 1. Clone and Setup

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Test Installation

```bash
python3 test_mcp_direct.py
```

You should see "All tests passed! MCP server is ready for use."

## Client Configuration

### After Automatic Installation

**Claude Desktop**: The installer automatically configures Claude Desktop. Just restart the app.

**Cursor**: Copy the configuration from the generated `cursor_mcp_config.json` file to your Cursor settings:

1. Open Cursor Settings (`Cmd+,` or `Ctrl+,`)
2. Search for "MCP" or "Model Context Protocol"  
3. Copy the content from `cursor_mcp_config.json`
4. Restart Cursor completely

### Manual Configuration

If you installed manually, configure your client:

#### Cursor

1. Open Cursor Settings (`Cmd+,` or `Ctrl+,`)
2. Search for "MCP" or "Model Context Protocol"
3. Add this configuration (replace paths with your actual paths):

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "/absolute/path/to/selenium-mcp-server/venv/bin/python",
      "args": ["mcp_server.py"],
      "cwd": "/absolute/path/to/selenium-mcp-server"
    }
  }
}
```

#### Claude Desktop

1. Find your Claude Desktop config file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. Add the server configuration (replace paths with your actual paths):

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "/absolute/path/to/selenium-mcp-server/venv/bin/python",
      "args": ["mcp_server.py"],
      "cwd": "/absolute/path/to/selenium-mcp-server"
    }
  }
}
```

3. Restart Claude Desktop

### VS Code

1. Install the MCP extension from marketplace
2. Open VS Code Settings (`Cmd+,` or `Ctrl+,`)
3. Search for "MCP"
4. Add to settings.json:

```json
{
  "mcp.servers": {
    "selenium-mcp": {
      "command": "/path/to/selenium-mcp-server/venv/bin/python",
      "args": ["./mcp_server.py"],
      "cwd": "/path/to/selenium-mcp-server"
    }
  }
}
```

5. Reload VS Code window

## Important Notes

### Using the Automatic Installer
- Run `python3 install.py` from the project root directory
- The installer handles all path configuration automatically
- Works on macOS, Windows, and Linux
- No need to manually edit paths or create virtual environments

### Path Configuration (Manual Setup Only)
- **Always use absolute paths** in the configuration
- Windows users: use forward slashes or double backslashes in JSON
- Point to the Python executable inside your virtual environment:
  - macOS/Linux: `venv/bin/python`
  - Windows: `venv\Scripts\python.exe`

### Verification
After installation, you should see:
- Green connection status in your MCP client
- 27+ tools available
- Tools like `navigate_to`, `click_element`, `generate_script` etc.

## Troubleshooting

### macOS Chrome Issues
If Chrome fails to start:
```bash
xattr -cr ~/.wdm/drivers/chromedriver/
```

### Connection Issues
1. Check logs: `tail -f mcp_server.log`
2. Verify paths are absolute
3. Ensure virtual environment is activated
4. Test manually: `python3 mcp_server.py`

### Reset Browser Session
If the automation browser gets stuck, use the `reset_automation_session` tool in your MCP client.

## Next Steps

Once installed, try:
1. "Navigate to example.com"
2. "Start recording, go to google.com, search for 'selenium', stop recording, generate pytest script"
3. "Reset automation session" (if browser gets stuck)