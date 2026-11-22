# selenium-ai-agent

> **Selenium AI Agent** (`selenium-ai-agent` on npm) is a Selenium MCP server for AI-driven test automation.
>
> - **Built in Node.js:** run it with `npx -y selenium-ai-agent`, no install needed.
> - **Generates tests in Python with pytest by default**, and in any other language or framework on request: Java, C#, JavaScript/TypeScript, WebdriverIO, Robot Framework.
> - **Test agents like Playwright's:** a planner explores your app and writes a structured test plan, a generator turns it into tests checked live in the browser, and a healer runs and repairs them.
> - **Works in Claude Desktop, Claude Code, VS Code (GitHub Copilot) and Cursor.**
> - **Scales with Selenium Grid** for parallel sessions on Chrome, Firefox and Edge.

**65 tools (79 with Selenium Grid)**, loadable in [groups](#tool-groups), with accessibility tree and shadow DOM discovery, selector teaching, BiDi cross-browser support, Selenium Grid parallel execution, the planner → generator → healer pipeline, and session tracing.

### Video Tutorials

Short demos with a voice-over, [on YouTube](https://www.youtube.com/@ralphvanderhorst5193/videos):

| Planner: from one prompt to a test plan | Generator: from the plan to running pytest tests |
|:---:|:---:|
| [![Planner demo](https://img.youtube.com/vi/M8JM35nA9hY/hqdefault.jpg)](https://www.youtube.com/watch?v=M8JM35nA9hY) | [![Generator demo](https://img.youtube.com/vi/cPUBRsP9MSo/hqdefault.jpg)](https://www.youtube.com/watch?v=cPUBRsP9MSo) |
| The planner explores a web shop and writes `specs/shopping-cart-and-checkout.md`: 2 suites, 8 tests, 16 steps. (2:09) | The generator writes one pytest file per plan test, runs them, and shows the HTML report, including a real bug it found. (1:44) |

More tutorials: [youtube.com/@ralphvanderhorst5193](https://www.youtube.com/@ralphvanderhorst5193/videos) · Practice site used in the demos: [practiceautomatedtesting.com](https://practiceautomatedtesting.com)

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
- Chrome browser for local runs (Firefox and Edge are available through Selenium Grid)
- ChromeDriver is provisioned automatically — the server detects your installed
  Chrome version, reuses a matching cached driver, and only downloads a new one
  when the version no longer matches. Run `npx selenium-ai-agent doctor` to verify.

## Driver Setup, Proxy & Troubleshooting

On first use the server resolves a `chromedriver` that matches your installed
Chrome. If that fails (corporate proxy, offline, corrupt cache), start here.

### `doctor` — preflight diagnostics

```bash
npx selenium-ai-agent doctor
```

From a cloned repo (e.g. when verifying on macOS or Linux):

```bash
cd selenium-mcp-server
npm ci && npm run build
node dist/bin/cli.js doctor
```

It checks, and prints a concrete fix for anything that fails:

- the bundled Selenium Manager binary resolves and is executable,
- Chrome is installed and which version,
- the driver provisioning plan — strategy (override / PATH / cache / direct / fallback), the chosen download URL, and the resolved driver path,
- per-host reachability: the **storage host** (required for the direct download) and the **metadata host** (only the Selenium Manager fallback needs it),
- where the driver cache lives.

### How the driver is obtained

The driver is downloaded for your **exact** Chrome version directly from the
Chrome-for-Testing storage host, so the metadata host
(`googlechromelabs.github.io`) — which is unreachable on some networks (broken
IPv6 routes → "No route to host") — is **not** on the normal path. Resolution
order, first match wins:

1. `SE_CHROMEDRIVER` — an explicit driver path (no network),
2. a `chromedriver` already on `PATH` (no network),
3. a cached driver matching your Chrome major (no network),
4. **direct download** from `storage.googleapis.com` (IPv4-forced, retried),
5. Selenium Manager discovery (fallback; uses the metadata host).

For restricted / air-gapped setups, set `SE_CHROMEDRIVER` to a local driver, or
`SE_CHROMEDRIVER_MIRROR` to a mirror of the Chrome-for-Testing storage layout.

> **`Selenium Manager binary not found at: /node_modules/...`?** Fixed in 3.3.1 —
> upgrade with `npm install -g selenium-ai-agent@latest` (or clear the npx cache).
> The binary is now resolved from the installed `selenium-webdriver` package
> rather than the working directory, so it works under npx.

### Corporate proxy

A GUI-launched MCP server does **not** inherit your shell's proxy. Configure it
explicitly in one place — a JSON file in your home directory:

`~/.selenium-ai-agent/config.json`

```json
{
  "proxy": "http://user:pass@proxy.corp:8080",
  "noProxy": "localhost,127.0.0.1,.internal"
}
```

The standard `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` environment variables are
also honoured and take precedence over the file. The proxy is injected
explicitly into the driver-download subprocess, so it works even when the parent
process has no proxy in its environment. (Keep credentials in this home-dir file
— never commit them.)

### Corrupt or half-extracted cache

A driver download interrupted mid-way can leave an unextracted `.zip` or a
non-executable file in the cache, causing `EACCES` / "Exec format error". The
server now detects this, removes just that cache entry, and re-resolves with
exponential backoff — it never spawns a `.zip` as an executable.

### Shared / network folders (VMware, mapped drives)

The driver cache defaults to `~/.cache/selenium` on every platform (macOS,
Linux and Windows alike — it is **not** `%LOCALAPPDATA%` on Windows). If your
home directory is on a shared (VMware/HGFS) or network mount, the OS may refuse
to execute the driver from there. Point the cache at a local disk:

```bash
# Windows
SE_CACHE_PATH=C:\selenium-cache
# macOS / Linux
SE_CACHE_PATH=/var/tmp/selenium
```

> Developing on macOS but running inside a Windows VM with the Mac folders
> shared in? Keep `SE_CACHE_PATH` on each guest's local disk so the driver is
> never executed across the share.

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

### JetBrains IDEs (IntelliJ IDEA, PyCharm, WebStorm, ...)

Three ways, depending on the assistant you use in the IDE. All three start the server with `npx`, so Node.js 18+ must be installed.

**Junie** (writes `~/.junie/mcp/mcp.json` for you; or put the same JSON in `.junie/mcp/mcp.json` in the project to share it with your team):

```bash
npx selenium-ai-agent install junie
npx selenium-ai-agent install junie --with-rules   # also Selenium's rules in Junie's guidelines
```

**AI Assistant**: *Settings → Tools → AI Assistant → Model Context Protocol (MCP) → Add*, choose *As JSON* and paste:

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "npx",
      "args": ["-y", "selenium-ai-agent"]
    }
  }
}
```

**GitHub Copilot**: *Settings → Tools → GitHub Copilot → Model Context Protocol (MCP) → Configure* opens `mcp.json`; add:

```json
{
  "servers": {
    "selenium-mcp": {
      "command": "npx",
      "args": ["-y", "selenium-ai-agent"]
    }
  }
}
```

Claude Code also works in the IDE's terminal (`claude mcp add selenium-mcp -- npx -y selenium-ai-agent`). In a Java project the generator writes Java with JUnit 5 or TestNG, as found in your `pom.xml` or `build.gradle`; in PyCharm, Python with pytest or unittest.

---

## Tool Auto-Approval (Reducing "Yes" Prompts)

All tools include MCP annotations (`readOnlyHint`, `destructiveHint`, etc.) that help clients auto-approve safe tools. Read-only tools like `capture_page`, `recording_status`, and `grid_status` are marked as non-destructive and can be auto-approved by clients that support annotations.

### Claude Desktop

After the first approval, click **"Always allow"** for each tool to stop future prompts. Tools marked `readOnlyHint: true` may be auto-approved by the client.

### Claude Code

Pre-approve all tools from this server in `.claude/settings.json`:

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
| `SELENIUM_HEADLESS` | `false` | Run browser in headless mode |
| `SELENIUM_STEALTH` | `false` | Enable stealth mode (masks basic automation flags; does not get past advanced bot protection such as Cloudflare) |
| `SELENIUM_MCP_TOOLSETS` | `all` | Comma-separated [tool groups](#tool-groups) to load, e.g. `core,generator,healer` |
| `SELENIUM_MCP_PLAN_REVIEW` | `required` | `off` turns the test plan review off: the generator then also uses plans nobody approved (faster, riskier) |
| `SELENIUM_ATTACH_CDP` | — | Attach to an already running Chrome at `host:port` (e.g. `127.0.0.1:9222`) instead of launching one |
| `SELENIUM_MCP_OUTPUT_MODE` | `stdout` | Output mode: `stdout` (return data to LLM) or `file` (save to disk) |
| `SELENIUM_MCP_OUTPUT_DIR` | auto | Output folder for test plans (`specs/`), tests and reports. Auto: the project the server runs in (the nearest folder with `.git`, `package.json`, `.claude`, `pom.xml`, `build.gradle`, `*.csproj`, `*.sln`, `pyproject.toml` or `requirements.txt`); outside any project `~/selenium-ai-agent`. `install` run in a project writes that project here, because Claude Desktop, Windsurf and Junie start the server outside it. `~` is allowed. `doctor` shows the folder in use |
| `SELENIUM_MCP_SAVE_TRACE` | `false` | Save session trace JSON to `<output>/traces/` |
| `SELENIUM_MCP_UNRESTRICTED_FILES` | `false` | Bypass workspace path validation (allow writing outside output dir) |
| `SE_AVOID_STATS` | — | Set to `true` to disable Selenium usage statistics |
| `HTTPS_PROXY` / `HTTP_PROXY` | — | Proxy for the driver download (overrides the config file) |
| `NO_PROXY` | — | Comma-separated hosts that bypass the proxy |
| `SE_CACHE_PATH` | `~/.cache/selenium` | Driver cache directory — point at a local disk when home is a shared/network folder |
| `SE_CHROMEDRIVER` | — | Absolute path to a chromedriver to use as-is (no network — for restricted/air-gapped setups) |
| `SE_CHROMEDRIVER_MIRROR` | Chrome-for-Testing storage | Base URL of a mirror of the Chrome-for-Testing storage layout |
| `SELENIUM_AI_AGENT_CONFIG` | `~/.selenium-ai-agent/config.json` | Override path to the proxy config file |
| `SELENIUM_AI_AGENT_SKIP_PROVISION` | — | Set to `1` to skip driver provisioning and let Selenium resolve the driver itself |
| `SELENIUM_AI_AGENT_SKIP_PREFLIGHT` | — | Set to `1` to skip the start-up driver check |
| `SELENIUM_AI_AGENT_PREFLIGHT_TIMEOUT_MS` | `30000` | Timeout for the start-up driver check |

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
npx selenium-ai-agent doctor   # run driver/proxy diagnostics and exit
npx selenium-ai-agent review   # review test plans in your browser: Approve / Request changes, without the AI
npx selenium-ai-agent init-agents --loop=claude   # install the planner/generator/healer agents
npx selenium-ai-agent init-agents --loop=claude --with-rules   # ... plus Selenium's rules in CLAUDE.md
```

| Flag | Description |
|------|-------------|
| `doctor` | Run preflight diagnostics (Chrome, driver, proxy, cache, output folder) and exit |
| `review [folder] [plan] [--no-open] [--port=…]` | Review test plans yourself, without asking the AI: opens the overview of all plans in the folder's `specs/` (default: the project you're in; or one plan) in your browser, with **Approve plan** / **Request changes** per plan. Runs on 127.0.0.1 until Ctrl+C; your AI assistant reads the decision from the plan. With no plans there, it lists the folders that have plans |
| `init-agents --loop=claude\|vscode\|copilot\|cursor [--server=name] [--with-rules[=...]] [--framework=f]` | Install the test agents for your AI client (see [Test Agents](#test-agents)) and exit; `--with-rules` also writes the [rules for AI agents](#rules-for-ai-agents) into the project |
| `install claude-desktop\|cursor\|windsurf\|junie [--output-dir=…] [--with-rules[=...]]` | Add the server to the client's config. Run it in your project: that project becomes the output folder (`SELENIUM_MCP_OUTPUT_DIR` in the config), so plans, tests and reports land there; an existing setup only moves to another project with `--output-dir=`. `--with-rules` also writes the rules into this project's instruction file |
| `--stealth` | Enable stealth mode |
| `--headless` | Run browser headless |
| `--no-plan-review` | Turn the test plan review off (same as `SELENIUM_MCP_PLAN_REVIEW=off`) |
| `--save-trace` | Save session trace JSON |
| `--output-mode=stdout\|file` | Set output mode |
| `--output-dir=<path>` | Set output directory |
| `--grid-url=<url>` | Set Selenium Grid hub URL |
| `--toolsets=<list>` | Load only these [tool groups](#tool-groups), e.g. `--toolsets=core,healer` |
| `--allow-unrestricted-file-access` | Bypass workspace file path validation |

---

## Tool Groups

Every tool definition is sent to the model on each request, so loading fewer tools saves context and helps the model pick the right one. Some MCP clients also limit how many tools they load. Use `SELENIUM_MCP_TOOLSETS` (or `--toolsets=`) to choose groups:

| Group | Tools | Contents |
|-------|-------|----------|
| `core` | 38 | Navigation, page analysis, elements, input, mouse, tabs, verification, browser, session, batch, docs (`get_selenium_docs`). Always loaded. |
| `recording` | 4 | Record actions for test generation |
| `planner` | 3 | Explore an app and save a test plan |
| `generator` | 6 | Generate tests (pytest, Java, C#, WebdriverIO, …). Also loads `recording`. |
| `healer` | 6 | Run, debug and fix failing tests; scan existing tests for outdated patterns |
| `analyzer` | 6 | Regression risk analysis |
| `grid` | 14 | Selenium Grid management and parallel execution (needs `SELENIUM_GRID_URL`) |

The default is `all`. For example, browsing and self-healing only:

```json
"env": { "SELENIUM_MCP_TOOLSETS": "core,healer" }
```

## Tools (79)

### Navigation (5)

| Tool | Description |
|------|-------------|
| `navigate_to` | Navigate the browser to a URL. Starts browser automatically if not running. |
| `go_back` | Navigate back in browser history. |
| `go_forward` | Navigate forward in browser history. |
| `refresh_page` | Refresh the current page. |
| `scroll_page` | Scroll the page in a direction (up/down/left/right) by pixel amount, or scroll a specific element into view by CSS selector. |

### Page Analysis (2)

| Tool | Description |
|------|-------------|
| `capture_page` | Capture the current page state as an accessibility tree — returns elements with ARIA roles, semantic hierarchy, and refs (e1, e2, ...). Discovers up to 300 elements with visibility-aware selectors, ancestor scoping, and Shadow DOM traversal. Read-only. |
| `take_screenshot` | Take a screenshot (viewport, full-page, or element). Uses BiDi when available for full-page/element screenshots, falls back to classic API. Params: `origin` (viewport/document), `ref` (element), `format` (png/jpeg), `quality`. |

### Elements (5)

| Tool | Description |
|------|-------------|
| `click_element` | Click an element using its ref from the page snapshot. |
| `hover_element` | Hover over an element using its ref. |
| `select_option` | Select a dropdown option by value, text, or index. |
| `drag_drop` | Drag from one element to another using refs. |
| `teach_selector` | Teach the system a preferred CSS selector for an element. Saved as Phase 0 (highest priority) in future element discovery on that domain. Auto-scopes to site-wide for header/nav/footer elements, or path-specific for content. |

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
| `resize_window` | Resize or move the window (`width`/`height`, `x`/`y`, presets) or change its state: `fullscreen` (in front, for demos and recordings), `maximize`, `minimize`, `normal` (restore). |
| `dialog_handle` | Handle browser dialogs (alert, confirm, prompt). |
| `console_logs` | Get or clear browser console logs. Uses BiDi event collector when available for cross-browser support, falls back to classic log API. |
| `network_monitor` | Monitor network requests: get requests, clear, or toggle offline mode. |
| `pdf_generate` | Generate a PDF from the current page. Uses BiDi `printPage` for cross-browser support (Chrome, Firefox, Edge), falls back to CDP. Params: `format`, `landscape`, `scale`, `pageRanges`. Optional `filePath` — omit to return as base64 resource. |

### Session (3)

| Tool | Description |
|------|-------------|
| `close_browser` | Close the browser and end the session. |
| `reset_session` | Reset the browser session (close and restart). |
| `set_stealth_mode` | Enable/disable stealth mode — masks `navigator.webdriver` and the automation info bar. Does not get past advanced bot protection such as Cloudflare. |

### Recording (4)

| Tool | Description |
|------|-------------|
| `start_recording` | Start recording browser actions for test script generation. |
| `stop_recording` | Stop recording and return full action log with element locators and framework hint. |
| `recording_status` | Check if recording is active and show recent actions. Read-only. |
| `clear_recording` | Clear all recorded browser actions. |

### Test Planner (5)

| Tool | Description |
|------|-------------|
| `planner_setup_page` | Start test planning: open the app, run optional `setupSteps` (e.g. a login) and load the `seedTest` that generated tests follow. |
| `planner_explore_page` | Explore a page: headings, input fields with their labels, test ids and dropdown options, buttons (incl. disabled), links (internal/external) and forms, as a compact inventory. |
| `planner_save_plan` | Save the test plan to `specs/`, where the generator reads it. Structured as in Playwright: suites (seed file) → tests (target file) → steps with `expect`, plus elements and gaps. |
| `planner_review_plan` | Open a plan as a review page in the user's browser: suites, tests, steps with expected results, elements and gaps, a comment box per test, and **Approve plan** / **Request changes** buttons that write the decision (and the comments) into the plan; an approved plan can be **reopened for review**. Without a plan: the overview of all plans with review status, tests, generated test files and the last run. Served on 127.0.0.1 with a random token; read-only copies in `specs/<plan>.html` and `specs/index.html`. |
| `planner_approve_plan` | Mark a reviewed plan approved, with the user's own words and the time. Every plan saved with `planner_save_plan` (or `generator_save_spec`) is a draft, and `generator_setup_page`, `generator_read_spec` and `generator_write_test` refuse a draft plan: tests are only generated from a plan someone has read. `skipPlanReview: true` only when the user explicitly skips the review. |

### Test Generator (6)

| Tool | Description |
|------|-------------|
| `generator_setup_page` | Initialize test generation session — navigate to app, start recording, set framework. |
| `generator_read_log` | Retrieve the action log from the recording session. Read-only. |
| `generator_write_test` | Save generated test code and update `.test-manifest.json`. Supports `verify` (validates selectors against live page) and `specFile` (links to spec). |
| `generator_write_seed` | Write a seed/bootstrap test (auth, fixtures, env setup) and register in manifest under `seedTests[]`. |
| `generator_save_spec` | Save a structured markdown spec to `<output>/specs/`. |
| `generator_read_spec` | Read a spec or test plan, by path or by name in `specs/`. Read-only. |

### Test Healer (6)

| Tool | Description |
|------|-------------|
| `selenium_rules_check` | Scan existing tests (a folder or a file) for Selenium 3 APIs, sleeps, mixed waits, driver managers and paths, the old headless API, absolute XPath, Robot `Sleep`, WebdriverIO `browser.pause()` and removed v10 APIs; lists findings per rule and per file with line numbers. Changes nothing. Used by the migrator. |
| `healer_run_tests` | Execute tests and return output. Supports manifest mode (reads `.test-manifest.json`) or explicit mode (provide command + args). Runs seed tests first when present. |
| `healer_debug_test` | Run a single test in verbose mode with detailed output (15KB stdout, 8KB stderr). |
| `healer_fix_test` | Apply a fix to a test file with `.bak` backup. Supports `verify` (validates selectors in fixed code). |
| `healer_inspect_page` | Inspect current page against expected locators — reports found, missing, and changed elements with suggested updated locators. Use after test failure to understand UI drift. |
| `browser_generate_locator` | Find an element from a plain description ("search box", "the Add to Cart button of the Mechanical Keyboard") using its text, label, placeholder, test id, kind and surrounding content; returns ready-to-paste locators for JavaScript, Python and Java. Inside web components it returns a `host >>> inner` path with Selenium `shadow_root` code. Read-only. |

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
| `batch_execute` | Execute up to 20 tool steps in a single round trip; step arguments can be any JSON (text, numbers, lists). Intermediate steps skip snapshots for speed. |

### Docs (1)

| Tool | Description |
|------|-------------|
| `get_selenium_docs` | Read the current Selenium (or WebdriverIO) docs as Markdown, from their `llms.txt`: the index, a page by URL or path, or the best page for a topic ("explicit waits"). Only selenium.dev and webdriver.io; cached for a day; falls back to the bundled rules offline. |

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

## Selector Teaching & Hints

The `teach_selector` tool lets you override auto-computed selectors with your own preferred CSS selectors. Taught selectors are persisted to `<output>/selector-hints.json` and loaded as **Phase 0** (highest priority) during element discovery on matching pages.

### How It Works

1. Call `teach_selector` with a description and CSS selector while on the page
2. The selector is validated in-browser (must match exactly 1 visible element)
3. Scope is auto-determined: header/nav/footer elements default to site-wide (`*`), content elements default to the current path pattern
4. On subsequent page snapshots, matching hints are loaded and used before any auto-computation

### Example

```
teach_selector({
  description: "the NL language link",
  css: "a[href='/nl/']",
  scope: "*"  // optional — auto-determined if omitted
})
```

Hints file structure (`selector-hints.json`):

```json
{
  "example.com": {
    "*": [
      { "css": "a[href='/nl/']", "tag": "a", "text": "NL" }
    ],
    "/blog/*": [
      { "css": "#post-title", "tag": "h1", "text": "My Post" }
    ]
  }
}
```

---

## Element Discovery

The server uses a 16-phase selector computation engine that produces human-readable, semantically meaningful CSS and XPath selectors for every discovered element.

### Selector Priority (Phases 0–16)

| Phase | Strategy | Example |
|-------|----------|---------|
| 0 | **Taught hints** | User-taught `a[href="/nl/"]` |
| 1 | **By ID** | `#login-form` |
| 2 | **By test ID** | `[data-testid="submit-btn"]` |
| 2b | **By descendant test ID** | `form:has([data-testid="email"])` |
| 3 | **By role + name** | `button[aria-label="Close"]` |
| 4 | **By label** | `//label[normalize-space()='Email']//input` |
| 5 | **By placeholder** | `input[placeholder="Search..."]` |
| 6 | **By text** | `//a[normalize-space()='Sign In']` |
| 7 | **By attribute** | `a[hreflang="nl"]`, `img[alt="Logo"]` |
| 9 | **By ARIA role** | `[role="dialog"]` |
| 10 | **By state** | `dialog[open]`, `[aria-expanded]` |
| 11 | **By table cell** | `#data-table > tbody > tr:nth-child(2) > td:nth-child(3)` |
| 12 | **By compound attrs** | `input[type="email"][name="user"]` |
| 13 | **By semantic class** | `button.primary-action` |
| 14 | **By position** | `#sidebar > ul > li:nth-of-type(3)` |
| 15 | **By text (loose)** | `//span[contains(normalize-space(),'Welcome')]` |
| 16 | **By positional index** | `(//button[normalize-space()='Save'])[2]` |

### Key Capabilities

- **Visibility-aware** — only visible elements are counted for uniqueness, preventing hidden duplicates from causing fallbacks to fragile selectors
- **Ancestor scoping** — when a selector isn't unique globally, it's scoped to the nearest ancestor with an ID, test attribute, or landmark (`nav[aria-label="Main"] a[href="/"]`)
- **Shadow DOM** — traverses open shadow roots, scopes CSS within shadow boundaries, uses `>>>` notation for cross-boundary selectors
- **Two-pass discovery** — semantic elements (links, buttons, headings) get refs first; generic elements with test attributes fill remaining budget
- **Non-semantic class filtering** — auto-skips CSS-in-JS hashes, Tailwind utilities, and framework-generated classes

---

## Test Agents

Like Playwright's test agents, Selenium AI Agent ships three agents (plus a regression analyzer) that work alone or in a loop:

- **selenium-test-planner** explores the app and writes a Markdown test plan to `specs/`
- **selenium-test-generator** turns a plan from `specs/` into tests (pytest, unittest, WebdriverIO, Robot Framework, …), verifying selectors live
- **selenium-test-healer** runs the tests and repairs failing ones
- **selenium-test-migrator** upgrades existing tests to current Selenium 4 (or WebdriverIO v10): it scans the suite with `selenium_rules_check`, runs it first as a baseline, rewrites one file at a time and proves each file still passes
- **selenium-regression-analyzer** builds a risk profile to decide what to test first

Install them into your project for your AI client, with the tool names that client expects:

```bash
npx selenium-ai-agent init-agents --loop=claude    # .claude/agents/*.md (Claude Code subagents)
npx selenium-ai-agent init-agents --loop=vscode    # .github/chatmodes/*.chatmode.md
npx selenium-ai-agent init-agents --loop=copilot   # .github/agents/*.agent.md (GitHub Copilot coding agent)
npx selenium-ai-agent init-agents --loop=cursor    # .cursor/rules/*.mdc (attach with @selenium-test-planner)
```

It reuses the server name from your project's MCP config (`.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`), or adds a `selenium-mcp` server when there is none; `--server=<name>` overrides it. Run it again after updating to pick up new tools and instructions.

### Rules for AI agents

The generator and healer follow the projects' own guides for AI coding agents, and check every test they write against them: [Selenium's](https://www.selenium.dev/documentation/ai_agents/) for Python, Java, C#, JavaScript, Ruby and Robot Framework, [WebdriverIO's](https://webdriver.io/docs/ai-agents) for WebdriverIO. `generator_write_test` and `healer_fix_test` refuse sleeps, driver managers and paths, `DesiredCapabilities`, Selenium 3 APIs, mixed implicit and explicit waits, `browser.pause()` and removed WebdriverIO APIs, and say which line breaks which rule.

The same rules can go into your project, for every AI tool you use, not only these agents:

```bash
npx selenium-ai-agent init-agents --loop=claude --with-rules              # CLAUDE.md
npx selenium-ai-agent init-agents --loop=cursor --with-rules              # .cursor/rules/selenium.mdc
npx selenium-ai-agent init-agents --loop=copilot --with-rules             # .github/copilot-instructions.md
npx selenium-ai-agent install cursor --with-rules=cursor,agents           # also AGENTS.md (Codex and others)
```

The section names the docs index, the examples, the pinned Selenium version (read from `requirements.txt`, `pom.xml`, `package.json`, ...), the required patterns and the language's own notes. It sits between `selenium-ai-agent:rules` markers, so running it again replaces only that section. `--framework=` overrides the detected language.

**MCP resources.** Clients that read resources get the docs and rules without web access: `selenium://docs/llms.txt`, `webdriverio://docs/llms.txt`, `selenium://rules/selenium.md` (Selenium's rules file, unchanged) and `selenium://rules/<python|java|javascript|csharp|ruby|robot-framework|webdriverio>`.

**Seed test and login.** Like Playwright's `seed.spec.ts`, the planner can start from a seed: `planner_setup_page` takes `seedTest` (a file whose fixtures, base URL and login the generated tests follow; default: the seed registered with `generator_write_seed`) and `setupSteps` (actions run in the browser before exploring, e.g. `fill` / `click` / `wait` for a login), so apps behind a login can be planned.

```
specs/                 # test plans from the planner, read by the generator
tests/                 # generated tests (+ seed test)
.test-manifest.json    # framework, run command, seed tests (used by the healer)
```

---

## Test Generation & Healing Pipeline

The generator and healer tools form a complete test automation pipeline:

### 1. Plan

```
planner_setup_page (seedTest, setupSteps) → planner_explore_page → planner_save_plan → specs/<plan>.md (draft)
  → planner_review_plan: the user reviews it in the browser → Approve (approved) or Request changes (back to the planner)
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
│   ├── element-discovery/   # Accessibility tree discovery (e1-e300)
│   │   ├── index.ts         # Barrel exports
│   │   ├── discover.ts      # discoverElements() with selector hints
│   │   ├── selector-scripts.ts # Browser-side computeSelector() (15 phases)
│   │   ├── tree-scripts.ts  # Browser-side accessibility tree walker
│   │   ├── format-tree.ts   # formatAccessibilityTree()
│   │   └── element-scripts.ts # extractElementInfo(), findElementByInfo()
│   ├── selector-hints.ts    # Persistent domain-scoped selector hint storage
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
└── tools/                 # 75 tools grouped by domain (see Tool Groups)
    ├── base.ts            # BaseTool abstract class + MCP annotations
    ├── index.ts           # Tool registry
    ├── navigation/        # navigate_to, go_back, go_forward, refresh_page, scroll_page
    ├── page/              # capture_page, take_screenshot
    ├── elements/          # click, hover, select, drag_drop, teach_selector
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
