# Changelog

## [3.3.5] - 2026-11-18

### Fixes

- **Recover from a dead local browser session.** A closed window, crashed browser or idle-killed chromedriver left a stale driver behind, and every later call failed with `invalid session id` until `reset_session` was called by hand. `ensureBrowser()` now probes the cached local/attached driver and relaunches with the same settings when it is gone, switching to a remaining window when only the current one was closed. Any tool that hits a lost session now clears it and says the next `navigate_to` starts a fresh browser. Recording state survives the recovery.
- **`SELENIUM_HEADLESS` / `--headless` now work.** The setting was documented but never passed to the browser config.
- **Stealth script no longer gives itself away.** `navigator.webdriver` now reads `false` (as in a normal Chrome) instead of `undefined`, and is patched on `Navigator.prototype` only when needed. The fake `plugins` array, forced `languages` and fake `chrome.runtime` were removed: each was easier to detect than the value it replaced. Descriptions now say plainly that stealth masks basic automation flags and does not get past advanced bot protection such as Cloudflare.

### New Features

- **Tool groups.** `SELENIUM_MCP_TOOLSETS` (or `--toolsets=`) loads only the groups you need: `core`, `recording`, `planner`, `generator`, `healer`, `analyzer`, `grid`. Default is `all`, so existing setups are unchanged.
- **Official MCP Registry.** Added `mcpName`, `server.json` and a `publish-mcp-registry` job that publishes to registry.modelcontextprotocol.io after each npm release.

### Housekeeping

- The npm package no longer ships compiled tests or source maps.
- Docs: tool counts made consistent (61 tools, 75 with Grid); removed the non-existent `claude --allow-mcp` flag and the unused `SELENIUM_BROWSER` / `SELENIUM_TIMEOUT` variables.

## [3.3.2] - 2026-06-19

### Fixes

- **Direct chromedriver download — no metadata host on the happy path.** Provisioning now downloads chromedriver for the *exact* installed Chrome version straight from the Chrome-for-Testing storage host:
  `https://storage.googleapis.com/chrome-for-testing-public/{version}/{platform}/chromedriver-{platform}.zip`.
  The version-metadata host (`googlechromelabs.github.io`) — unreachable on some networks (broken IPv6 routes → "No route to host") — is no longer required. Selenium Manager discovery, which depends on that host, is now only a fallback.
- **IPv4-forced, resilient downloads** — downloads force IPv4 (avoiding broken IPv6 routes), follow redirects and retry with exponential backoff. The zip is unpacked with a built-in `node:zlib`-based reader — no new dependency.

### New Features

- **Resolution order** — `SE_CHROMEDRIVER` override → chromedriver on `PATH` → cached driver → direct download → Selenium Manager fallback. The first three make no network call at all.
- **Overrides for restricted / air-gapped environments**:
  - `SE_CHROMEDRIVER` — absolute path to a chromedriver to use as-is (no network).
  - `SE_CHROMEDRIVER_MIRROR` — base URL of a mirror of the Chrome-for-Testing storage layout.
  - A chromedriver already on `PATH` or in the cache is accepted without any network call.
- **Cross-platform** — download platform derived from `process.platform` + `process.arch`: `mac-arm64`, `mac-x64`, `linux64`, `win64`/`win32`. On macOS the driver is made executable and its `com.apple.quarantine` attribute is cleared.
- **`doctor`** now shows the detected Chrome version, the chosen download URL, the planned strategy (override / path / cache / direct / fallback), and **per-host** reachability — the metadata host is reported but never fails the report.

## [3.3.1] - 2026-06-19

### Fixes

- **Selenium Manager binary not found under npx** — driver provisioning failed on first use with `Selenium Manager binary not found at: /node_modules/selenium-webdriver/bin/.../selenium-manager` (note the leading slash). The bundled binary was resolved relative to `process.cwd()` instead of the real install location, so it was never found under `npx` (where `selenium-webdriver` lives in the npx cache). It is now resolved via Node's module resolution from the installed `selenium-webdriver` package, working under npx, global and local installs alike.
  - The platform sub-path is chosen from `process.platform` (`darwin` → `bin/macos`, `linux` → `bin/linux`, `win32` → `bin/windows/...exe`).
  - Resolution now fails with a clear, actionable error (the attempted path plus a reinstall hint) when the binary is genuinely missing or not executable.
  - The `doctor` command reports the resolved Selenium Manager path and whether it exists and is executable, and the diagnostic command in error messages points at the resolved path instead of a hardcoded `./node_modules/...`.

## [3.3.0] - 2026-06-19

### New Features

- **Robust driver provisioning** — the matching `chromedriver` is now resolved explicitly *before* the browser launches, instead of implicitly inside Selenium's `.build()`. The server detects the installed Chrome version, reuses a matching cached driver, and only resolves/downloads when the major version no longer matches — then hands the verified path to the `Service` so no unnecessary auto-download is triggered. Nothing is pinned; it tracks Chrome updates automatically. Skippable via `SELENIUM_AI_AGENT_SKIP_PROVISION=1`.

- **Corrupt-cache recovery** — an interrupted download that leaves an unextracted `.zip` or a non-executable file is detected, the single affected cache entry is removed, and resolution is retried with exponential backoff. A `.zip` is never spawned as an executable (fixes `EACCES` / "Exec format error" on first use).

- **Corporate proxy support** — proxy settings are read from one config file (`~/.selenium-ai-agent/config.json`, override via `SELENIUM_AI_AGENT_CONFIG`) and the standard `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` environment variables (env takes precedence). They are injected explicitly into the driver-download subprocess, so resolution works even when a GUI-launched server does not inherit the shell's proxy.

- **`doctor` command** — `npx selenium-ai-agent doctor` runs preflight diagnostics: Chrome presence and version, an executable matching driver, download-endpoint reachability (through the proxy), and the cache location — printing a concrete fix for anything that fails.

### Fixes

- **Driver cache directory on Windows** — Selenium's cache is `~/.cache/selenium` on every platform, not `%LOCALAPPDATA%\selenium`. The start-up preflight now targets the correct directory (the previous path meant cache recovery silently operated on the wrong folder on Windows).

- **`SE_CACHE_PATH`** is now honoured for locating cached drivers, allowing the cache to be moved off a shared/network mount (e.g. a VMware-shared home folder) onto a local disk.

## [3.1.0] - 2026-03-24

### Breaking Changes

- **Removed smart and minimal snapshot modes** — only full mode remains. Smart mode silently collapsed elements (hiding them from the AI), causing missed assertions and inability to interact with hidden refs. Minimal mode stripped all tree hierarchy, losing context about element location on the page. Both produced unreliable results even on simple pages. The `SnapshotMode` type, `SELENIUM_MCP_SNAPSHOT_MODE` env var, `snapshotOptions.mode` parameter, and `snapshotMode` config option have all been removed.

## [3.0.0] - 2026-03-19

### Breaking Changes

- **Element discovery module refactored** — the monolithic `src/utils/element-discovery.ts` (1339 lines) has been split into a modular `src/utils/element-discovery/` directory with dedicated files for selector computation, tree scripts, formatting, and element resolution. Import paths have changed from `./utils/element-discovery.js` to `./utils/element-discovery/index.js`. Public API remains identical.
- **Max discoverable elements increased** from 200 to 300, improving coverage on complex pages.

### New Features

- **`teach_selector` tool** — Teach the system a preferred CSS selector for any element. The selector is validated in-browser (must match exactly 1 visible element), then saved to a per-domain hints file (`selector-hints.json`). Taught selectors are used as Phase 0 (highest priority) in future element discovery, ensuring stable, user-chosen selectors take precedence over auto-computed ones.
  - Auto-determines scope: elements in `<header>`, `<nav>`, or `<footer>` default to site-wide (`*`), while content elements default to the current path pattern.
  - Supports manual scope override (e.g., `"/blog/*"`, `"*"`).
  - Idempotent: re-teaching the same CSS selector updates the existing hint.

- **Selector hints system** (`src/utils/selector-hints.ts`) — A persistent, domain-scoped hint storage system:
  - Hints are stored as JSON keyed by domain and path pattern.
  - On every page snapshot, hints for the current domain+path are loaded and passed to element discovery as Phase 0 candidates.
  - Simple glob matching for path scopes (e.g., `/blog/*` matches `/blog/my-post`).
  - Non-critical: hint loading failures are silently ignored to avoid breaking snapshots.

### Semantic Element Recognition Improvements

- **Visibility-aware uniqueness** — Selector uniqueness now checks only *visible* elements. Previously `querySelectorAll().length === 1` counted hidden elements, causing valid selectors to be skipped and falling back to fragile XPath text matchers. Now `cssUnique()` and `xpathUnique()` filter by visibility (non-zero size, not `display:none`/`visibility:hidden`/`opacity:0`), producing more accurate and human-readable CSS selectors.

- **Ancestor scope fallback** — New `findAncestorScope()` walks up the DOM to find the nearest scoping ancestor (by `#id`, semantic attributes like `data-testid`, landmark with `aria-label`, or positional landmark). All selector phases now try unscoped first, then scoped. This means duplicate elements (e.g., "Home" link in both header nav and footer) now get proper scoped selectors like `nav[aria-label="Main navigation"] a[href="/"]` instead of falling through to fragile XPath `normalize-space()` matchers.

- **Shadow DOM support** — The accessibility tree walker now traverses open shadow roots, discovering elements inside web components. `computeSelector()` detects shadow DOM context, scopes CSS queries within the shadow root, uses `>>>` notation for cross-boundary selectors, and disables XPath (which cannot cross shadow boundaries).

- **Two-pass ref assignment** — Semantic elements (links, buttons, headings, landmarks) get refs first in pass 1. Generic elements discovered via test attributes (`data-testid`, `data-test`, `data-cy`, `data-qa`) or custom elements (tags with hyphens) are deferred to pass 2, filling remaining ref budget without stealing slots from higher-priority semantic elements.

- **Generic element discovery** — Elements with test-anchor attributes (`data-testid`, `data-test`, `data-cy`, `data-qa`) or custom HTML elements (web components with hyphenated tags) are now discovered with role `generic`, even without an ARIA role or interactivity. Fallback naming uses the test attribute value, then any meaningful attribute.

- **Phase 2b: byDescendantTestId** — When an element itself lacks a test ID but a direct child has one, uses CSS `:has(> child[data-testid="..."])` selector for modern browsers, with XPath fallback.

- **Phase 16: byPositionalIndex** — New last-resort fallback when all 15 phases fail. Finds the element's position among all matches of a good base selector (test ID, text match) and produces `(xpath)[N]` positional selectors.

- **Deeper positional chain** — Phase 14 (byIndex) now walks up to 5 ancestor levels (was 2) and adds `nth-of-type` to ancestor nodes that have same-tag siblings, producing more precise positional selectors.

- **Explicit role handling in Phase 3** — Elements with explicit `role` attributes (e.g., `div[role="button"]`) are now handled in the byRole+name phase even when the tag has no implicit role mapping.

- **`hreflang` attribute support** — Added to attribute priority list, enabling CSS selectors like `a[hreflang="nl"]` for language switcher links instead of falling back to XPath text matching.

### Architecture

- **Element discovery split into modules:**
  - `element-discovery/index.ts` — barrel exports (public API unchanged)
  - `element-discovery/discover.ts` — `discoverElements()` with selector hints support
  - `element-discovery/selector-scripts.ts` — browser-side `computeSelector()` (16-phase selector computation)
  - `element-discovery/tree-scripts.ts` — browser-side accessibility tree walker with two-pass ref assignment
  - `element-discovery/format-tree.ts` — `formatAccessibilityTree()` with full/smart/minimal modes
  - `element-discovery/element-scripts.ts` — `extractElementInfo()` and `findElementByInfo()`

### Tool Count

- Total tools: **75** (was 74) — added `teach_selector` in the Elements category.

## [2.9.0] - 2025-xx-xx

- Added snapshot mode (full/smart/minimal) and improved selector computation.

## [2.8.0] - 2025-xx-xx

- Coerced string-encoded numeric params in all tools.

## [2.7.0] - 2025-xx-xx

- Version bump and maintenance release.
