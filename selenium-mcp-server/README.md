# Selenium MCP Server

A TypeScript MCP (Model Context Protocol) server for AI-powered browser automation using Selenium WebDriver.

## Installation

```bash
# Install globally
npm install -g selenium-mcp

# Or run directly with npx
npx selenium-mcp
```

## Requirements

- Node.js 18+
- Chrome browser installed
- ChromeDriver (automatically managed by selenium-webdriver)

## MCP Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "selenium": {
      "command": "npx",
      "args": ["selenium-mcp"]
    }
  }
}
```

## Available Tools

### Navigation
- `navigate_to` - Navigate to a URL
- `go_back` - Go back in browser history
- `go_forward` - Go forward in browser history
- `refresh_page` - Refresh the current page

### Page
- `capture_page` - Capture page snapshot with interactive elements
- `take_screenshot` - Take a screenshot

### Elements
- `click_element` - Click on an element
- `hover_element` - Hover over an element
- `select_option` - Select dropdown option

### Input
- `input_text` - Type text into input fields
- `key_press` - Press keyboard keys

### Browser
- `wait_for` - Wait for conditions (element visible, URL contains, etc.)
- `execute_javascript` - Run JavaScript in browser
- `resize_window` - Resize browser window

### Session
- `close_browser` - Close the browser
- `reset_session` - Reset browser session

## Usage Example

The AI assistant interacts with pages using element references from snapshots:

```
1. AI calls navigate_to with url "https://example.com"
2. Server returns page snapshot with elements: [e1] button: Login, [e2] input: Search...
3. AI calls click_element with ref "e1"
4. Server clicks the Login button and returns updated snapshot
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev
```

## License

MIT
