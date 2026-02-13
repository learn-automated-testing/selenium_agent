# selenium-ai-agent

Selenium MCP server for AI-driven browser automation — **73 tools** including BiDi cross-browser support, Selenium Grid parallel execution, test generation/healing pipeline, and session tracing.

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

---

## Tool Auto-Approval (Reducing "Yes" Prompts)

All tools include MCP annotations (`readOnlyHint`, `destructiveHint`, etc.) that help clients auto-approve safe tools. Read-only tools like `capture_page`, `recording_status`, and `grid_status` are marked as non-destructive and can be auto-approved by clients that support annotations.

### Claude Desktop

After the first approval, click **"Always allow"** for each tool to stop future prompts. Tools marked `readOnlyHint: true` may be auto-approved by the client.

### Claude Code

Use `--allow-mcp selenium-mcp` to pre-approve all tools from this server:

```bash
claude --allow-mcp selenium-mcp
```

Or configure in `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": ["mcp__selenium-mcp__*"]
  }
}
```

### Cursor / Cline / Windsurf

These clients typically allow you to configure auto-approval per tool or per server in their settings. Check your client's MCP settings for "auto-approve" or "always allow" options.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SELENIUM_GRID_URL` | — | Grid hub URL (enables parallel features) |
| `SELENIUM_BROWSER` | `chrome` | Browser to use (`chrome`, `firefox`, `edge`) |
| `SELENIUM_HEADLESS` | `false` | Run browser in headless mode |
| `SELENIUM_STEALTH` | `false` | Enable stealth mode (hide automation indicators) |
| `SELENIUM_MCP_OUTPUT_MODE` | `stdout` | Output mode: `stdout` (return data to LLM) or `file` (save to disk) |
| `SELENIUM_MCP_OUTPUT_DIR` | auto | Output directory for generated files (auto-detected from project root) |
| `SELENIUM_MCP_SAVE_TRACE` | `false` | Save session trace JSON to `<output>/traces/` |
| `SELENIUM_MCP_UNRESTRICTED_FILES` | `false` | Bypass workspace path validation (allow writing outside output dir) |
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
        "SELENIUM_STEALTH": "true",
        "SE_AVOID_STATS": "true"
      }
    }
  }
}
```

## CLI Flags

```bash
npx selenium-ai-agent [flags]
```

| Flag | Description |
|------|-------------|
| `--stealth` | Enable stealth mode |
| `--headless` | Run browser headless |
| `--save-trace` | Save session trace JSON |
| `--output-mode=stdout\|file` | Set output mode |
| `--output-dir=<path>` | Set output directory |
| `--grid-url=<url>` | Set Selenium Grid hub URL |
| `--allow-unrestricted-file-access` | Bypass workspace file path validation |

---

## Tools (73)

### Navigation (4)

| Tool | Description |
|------|-------------|
| `navigate_to` | Navigate the browser to a URL. Starts browser automatically if not running. |
| `go_back` | Navigate back in browser history. |
| `go_forward` | Navigate forward in browser history. |
| `refresh_page` | Refresh the current page. |

### Page Analysis (2)

| Tool | Description |
|------|-------------|
| `capture_page` | Capture the current page state — returns interactive elements with refs (e1, e2, ...). Read-only. |
| `take_screenshot` | Take a screenshot (viewport, full-page, or element). Uses BiDi when available for full-page/element screenshots, falls back to classic API. Params: `origin` (viewport/document), `ref` (element), `format` (png/jpeg), `quality`. |

### Elements (4)

| Tool | Description |
|------|-------------|
| `click_element` | Click an element using its ref from the page snapshot. |
| `hover_element` | Hover over an element using its ref. |
| `select_option` | Select a dropdown option by value, text, or index. |
| `drag_drop` | Drag from one element to another using refs. |

### Input (3)

| Tool | Description |
|------|-------------|
| `input_text` | Type text into an input field or textarea. |
| `key_press` | Press a keyboard key, optionally with modifiers (ctrl, alt, shift, meta). |
| `file_upload` | Upload a file through a file input element. |

### Mouse (3)

| Tool | Description |
|------|-------------|
| `mouse_move` | Move mouse to specific coordinates. |
| `mouse_click` | Click at coordinates with specified button (left, right, middle). |
| `mouse_drag` | Drag from one position to another. |

### Tabs (4)

| Tool | Description |
|------|-------------|
| `tab_list` | List all open browser tabs with titles and URLs. Read-only. |
| `tab_select` | Switch to a specific browser tab. |
| `tab_new` | Open a new browser tab, optionally navigating to a URL. |
| `tab_close` | Close a specific browser tab. |

### Verification (4)

| Tool | Description |
|------|-------------|
| `verify_element_visible` | Verify that an element is visible on the page (with timeout). Read-only. |
| `verify_text_visible` | Verify that specific text is visible on the page (with timeout). Read-only. |
| `verify_value` | Verify that an input element has the expected value. Read-only. |
| `verify_list_visible` | Verify that multiple text items are all visible on the page. Read-only. |

### Browser (7)

| Tool | Description |
|------|-------------|
| `wait_for` | Wait for a condition: element visible, clickable, present, URL contains, or title contains. |
| `execute_javascript` | Execute JavaScript code in the browser context with optional return value. |
| `resize_window` | Resize the browser window to specified dimensions. |
| `dialog_handle` | Handle browser dialogs (alert, confirm, prompt). |
| `console_logs` | Get or clear browser console logs. Uses BiDi event collector when available for cross-browser support, falls back to classic log API. |
| `network_monitor` | Monitor network requests: get requests, clear, or toggle offline mode. |
| `pdf_generate` | Generate a PDF from the current page. Uses BiDi `printPage` for cross-browser support (Chrome, Firefox, Edge), falls back to CDP. Params: `format`, `landscape`, `scale`, `pageRanges`. Optional `filePath` — omit to return as base64 resource. |

### Session (3)

| Tool | Description |
|------|-------------|
| `close_browser` | Close the browser and end the session. |
| `reset_session` | Reset the browser session (close and restart). |
| `set_stealth_mode` | Enable/disable stealth mode — hides `navigator.webdriver`, patches plugins, sets realistic languages. |

### Recording (4)

| Tool | Description |
|------|-------------|
| `start_recording` | Start recording browser actions for test script generation. |
| `stop_recording` | Stop recording and return full action log with element locators and framework hint. |
| `recording_status` | Check if recording is active and show recent actions. Read-only. |
| `clear_recording` | Clear all recorded browser actions. |

### Test Planner (3)

| Tool | Description |
|------|-------------|
| `planner_setup_page` | Initialize test planning — navigate to app and start exploring. |
| `planner_explore_page` | Explore a page in detail, discovering elements, forms, and links. |
| `planner_save_plan` | Save completed test plan to a markdown file. |

### Test Generator (6)

| Tool | Description |
|------|-------------|
| `generator_setup_page` | Initialize test generation session — navigate to app, start recording, set framework. |
| `generator_read_log` | Retrieve the action log from the recording session. Read-only. |
| `generator_write_test` | Save generated test code and update `.test-manifest.json`. Supports `verify` (validates selectors against live page) and `specFile` (links to spec). |
| `generator_write_seed` | Write a seed/bootstrap test (auth, fixtures, env setup) and register in manifest under `seedTests[]`. |
| `generator_save_spec` | Save a structured markdown spec to `<output>/specs/`. |
| `generator_read_spec` | Read a spec file. Read-only. |

### Test Healer (5)

| Tool | Description |
|------|-------------|
| `healer_run_tests` | Execute tests and return output. Supports manifest mode (reads `.test-manifest.json`) or explicit mode (provide command + args). Runs seed tests first when present. |
| `healer_debug_test` | Run a single test in verbose mode with detailed output (15KB stdout, 8KB stderr). |
| `healer_fix_test` | Apply a fix to a test file with `.bak` backup. Supports `verify` (validates selectors in fixed code). |
| `healer_inspect_page` | Inspect current page against expected locators — reports found, missing, and changed elements with suggested updated locators. Use after test failure to understand UI drift. |
| `browser_generate_locator` | Generate robust locator strategy for an element by description. Read-only. |

### Regression Analyzer (6)

| Tool | Description |
|------|-------------|
| `analyzer_setup` | Initialize regression analysis session with product URL and business context. |
| `analyzer_import_context` | Import additional context from files, inline text, or URLs. |
| `analyzer_scan_product` | Explore product using process walking and page scanning. |
| `analyzer_build_risk_profile` | Build risk profile from discovered features and context. Read-only. |
| `analyzer_save_profile` | Save risk profile to YAML or JSON file. |
| `analyzer_generate_documentation` | Generate product discovery documentation with screenshots. |

### Batch (1)

| Tool | Description |
|------|-------------|
| `batch_execute` | Execute up to 20 tool steps in a single round trip. Intermediate steps skip snapshots for speed. |

### Grid Management (4)

| Tool | Description |
|------|-------------|
| `grid_status` | Check Grid status — nodes, browsers, capacity. Read-only. |
| `grid_start` | Start Selenium Grid via Docker Compose with configurable Chrome/Firefox node counts. |
| `grid_stop` | Stop Selenium Grid. |
| `grid_scale` | Scale Grid to desired number of browser nodes. |

### Grid Sessions (5)

| Tool | Description |
|------|-------------|
| `session_create` | Create a new browser session on the Grid. |
| `session_select` | Select a grid session as active browser for all subsequent tool calls. |
| `session_list` | List all active Grid sessions, optionally filtered by tags. Read-only. |
| `session_destroy` | Destroy a specific Grid session. |
| `session_destroy_all` | Destroy all Grid sessions, optionally filtered by tags. |

### Grid Parallel Execution (3)

| Tool | Description |
|------|-------------|
| `parallel_explore` | Explore multiple URLs in parallel — each target gets its own Grid session. |
| `parallel_execute` | Execute multiple task sequences in parallel across Grid sessions. |
| `planner_generate_plan` | Generate structured test plan from parallel exploration results. |

### Grid Exploration Analysis (2)

| Tool | Description |
|------|-------------|
| `exploration_merge` | Merge multiple exploration results, deduplicate pages, build site map. Read-only. |
| `exploration_diff` | Compare two exploration results — find added, removed, and changed pages. Read-only. |

---

## Expectation System

Every tool accepts an optional `expectation` parameter to control what data is included in the response:

```json
{
  "expectation": {
    "includeSnapshot": true,
    "includeConsole": true,
    "includeNetwork": true,
    "snapshotOptions": { "selector": "#main", "maxLength": 5000 },
    "consoleOptions": { "levels": ["error", "warn"], "maxMessages": 10 },
    "diffOptions": { "enabled": true, "format": "unified" }
  }
}
```

| Option | Description |
|--------|-------------|
| `includeSnapshot` | Include page snapshot (element list) in the response |
| `includeConsole` | Include browser console logs |
| `includeNetwork` | Include network request summary (requires BiDi) |
| `snapshotOptions.selector` | CSS selector to scope element discovery |
| `snapshotOptions.maxLength` | Truncate snapshot text at this length |
| `consoleOptions.levels` | Filter by log level: `error`, `warn`, `info`, `log` |
| `diffOptions.enabled` | Return only changes since last snapshot |
| `diffOptions.format` | Diff format: `minimal` or `unified` |

Each tool category has sensible defaults (e.g., navigation tools include snapshot, verification tools don't).

---

## BiDi Cross-Browser Features

The server uses WebDriver BiDi protocol (always enabled) for cross-browser features that go beyond what the classic WebDriver API offers:

- **Full-page screenshots** — `take_screenshot` with `origin: "document"` captures the entire scrollable page, not just the viewport
- **Element screenshots** — `take_screenshot` with `ref: "e5"` captures a specific element
- **Cross-browser PDF** — `pdf_generate` works on Chrome, Firefox, and Edge (was Chrome-only with CDP)
- **Console events** — `console_logs` uses BiDi `LogInspector` for real-time console events across all browsers
- **Network monitoring** — BiDi network events provide request/response tracking
- **Stealth mode** — Injects preload scripts via BiDi `script.addPreloadScript` to mask automation indicators

BiDi features degrade gracefully — if a browser doesn't support a specific BiDi feature, the tool falls back to the classic API.

---

## Test Generation & Healing Pipeline

The generator and healer tools form a complete test automation pipeline:

### 1. Plan

```
planner_setup_page → planner_explore_page → planner_save_plan
```

### 2. Record & Generate

```
generator_setup_page → [interact with app] → stop_recording → generator_write_test
```

- Recording captures actions with element locators (id, name, text, aria-label)
- `generator_write_test` validates selectors against the live page before saving
- A `.test-manifest.json` is created alongside tests with framework, run command, and test list

### 3. Heal

```
healer_run_tests → healer_inspect_page → healer_fix_test → healer_run_tests
```

- `healer_run_tests` reads `.test-manifest.json` to auto-discover how to run tests
- `healer_inspect_page` compares expected locators against the live page to find UI drift
- `healer_fix_test` validates selectors in the fixed code before writing
- Seed tests (auth, fixtures) are run automatically before the main test when registered in the manifest

### Spec Files

Save structured requirements as markdown specs before generating tests:

```
generator_save_spec → generator_write_test (with specFile param)
```

---

## Session Tracing

Enable tracing to record every tool call and result as structured JSON:

```bash
npx selenium-ai-agent --save-trace
```

Or via env var:

```json
{
  "env": { "SELENIUM_MCP_SAVE_TRACE": "true" }
}
```

Traces are saved to `<output>/traces/session-<timestamp>.json` on session close. Each trace entry records:
- Tool name and parameters
- Result content and error status
- Timestamps for performance analysis

---

## Workspace Isolation

By default, all file-writing tools (screenshots, PDFs, test files, plans, analyzer output) validate that paths resolve within the output directory. This prevents accidental writes to system paths.

To override (e.g., for CI/CD or trusted environments):

```bash
npx selenium-ai-agent --allow-unrestricted-file-access
```

The `healer_fix_test` tool is exempt — it modifies existing project test files by design.

---

## Selenium Grid

For parallel browser automation across multiple browsers, set `SELENIUM_GRID_URL`:

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

### Quick Start with Docker Compose

The project includes a Docker Compose file for local Grid setup:

```bash
# Start Grid with 4 Chrome + 1 Firefox nodes
grid_start

# Or use docker-compose directly
docker compose up -d
```

### Parallel Workflows

**Parallel exploration** — explore multiple sections of a site simultaneously:
```
session_create (x3) → parallel_explore → exploration_merge
```

**Parallel execution** — run test steps across browsers:
```
session_create (chrome + firefox) → parallel_execute
```

**Cross-browser testing** — same actions on different browsers:
```
session_create (chrome) → session_create (firefox) → parallel_execute
```

See the [project README](https://github.com/learn-automated-testing/selenium_agent#readme) for Docker Compose setup and Grid architecture details.

---

## Output Mode

Control how binary data (screenshots, PDFs) is returned:

| Mode | Behavior |
|------|----------|
| `stdout` (default) | Return base64-encoded data to the LLM for inline display |
| `file` | Save to disk in `<output>/screenshots/` or `<output>/pdfs/` |

```bash
npx selenium-ai-agent --output-mode=file
```

---

## Architecture

```
selenium-mcp-server/src/
├── server.ts              # MCP server, tool routing, expectation system, tracing
├── context.ts             # Browser session state, EventCollector, SessionTracer
├── types.ts               # Core types (ToolResult, BrowserConfig, Expectation, Grid types)
├── types/
│   └── manifest.ts        # Shared test manifest types (generator ↔ healer)
├── bidi/
│   ├── event-collector.ts # BiDi event subscriptions (console, network, navigation)
│   └── index.ts
├── trace/
│   ├── session-tracer.ts  # Tool call + result recording
│   └── index.ts
├── utils/
│   ├── bidi-helpers.ts    # BiDi WebSocket URL rewriting + context factory
│   ├── chrome-options.ts  # Chrome options builder + stealth scripts
│   ├── element-discovery.ts # Element ref system (e1-e100)
│   ├── paths.ts           # Output directory resolution
│   ├── sandbox.ts         # Workspace path validation
│   ├── selector-validation.ts # Extract + validate selectors from test code
│   ├── schema.ts          # Zod → JSON Schema converter
│   └── docker.ts          # Docker Compose helpers
├── grid/
│   ├── grid-client.ts     # Grid REST API client
│   ├── grid-session.ts    # Remote browser session
│   ├── session-pool.ts    # Session lifecycle management
│   ├── session-context.ts # Context adapter for grid sessions
│   └── exploration-coordinator.ts
└── tools/                 # 73 tools grouped by domain
    ├── base.ts            # BaseTool abstract class + MCP annotations
    ├── index.ts           # Tool registry
    ├── navigation/        # navigate_to, go_back, go_forward, refresh_page
    ├── page/              # capture_page, take_screenshot
    ├── elements/          # click, hover, select, drag_drop
    ├── input/             # input_text, key_press, file_upload
    ├── mouse/             # mouse_move, mouse_click, mouse_drag
    ├── tabs/              # tab_list, tab_select, tab_new, tab_close
    ├── verification/      # verify_element_visible, verify_text, verify_value, verify_list
    ├── browser/           # wait, javascript, resize, dialog, console, network, pdf
    ├── session/           # close_browser, reset_session, set_stealth_mode
    ├── recording/         # start, stop, status, clear
    ├── agents/            # planner, generator, healer, spec tools
    ├── analyzer/          # setup, import, scan, risk, save, documentation
    ├── batch/             # batch_execute
    └── grid/              # 14 grid management + parallel execution tools
```

## License

MIT
