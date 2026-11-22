# Changelog

## [Unreleased]

### New Features

- **The test plan review is enforced.** A generated test is only as good as the plan it implements, so tests are only generated from a plan the user has approved. Until now this was an instruction to the planner and generator agents; Playwright's test agents don't have it at all.
  - `planner_save_plan` (and `generator_save_spec`) save every plan as a draft: `**Status:** draft` under the title, also when the content claims otherwise, so a changed plan is reviewed again.
  - The new `planner_approve_plan` tool marks a plan approved after the user has read it. It needs the user's own words, and writes them with the time into the plan. Users can also change the line themselves.
  - `generator_setup_page`, `generator_read_spec` and `generator_write_test` (with `specFile`) refuse a draft plan, with an error that tells the agent to show the plan to the user first. `skipPlanReview: true` starts from a draft only when the user explicitly asks to skip the review.
  - A plan written by hand without a status line is still accepted, with a note to check that it is reviewed. The sample plans in `examples/` are marked approved.
- **Review plans in the browser.** `planner_review_plan` opens a test plan as a readable page in the user's own browser: suites, tests, steps with their expected results, elements and gaps, a comment box per test, and **Approve plan** / **Request changes** buttons. Approve writes the approval into the plan; **Reopen for review** puts an approved plan (or one with changes requested) back to draft, so the generator waits for a new approval. Request changes needs a comment, writes the comments into a "Review comments" section and sets the status to "changes requested", which the generator also refuses; the planner then changes the plan and asks again. The page is served on 127.0.0.1 with a random token and only reads and writes plans in `specs/`.
- **Overview of all test plans.** `planner_review_plan` without a plan opens an overview: every plan with its review status, number of tests, the test files generated from it and their last results. `healer_run_tests` now keeps the latest results in `.test-runs.json` for it. Read-only copies are kept up to date in `.selenium-ai-agent/review/` (`<plan>.html`, `index.html`; the folder ignores itself in git), to share or attach to a pull request. Nothing is written into your own folders but the plans.
- **Review plans yourself: `npx selenium-ai-agent review`.** Run it in your project and the overview of all plans opens in your browser, where you approve plans or request changes directly, without asking the AI. It runs on 127.0.0.1 until Ctrl+C (`review <plan>` opens one plan, `--no-open` only prints the link). The read-only copies show this command.
- **Where plans go: the project, or a generic folder for Claude Desktop.** Projects are now also recognised by `pom.xml`, `build.gradle`, `*.csproj`, `*.sln`, `pyproject.toml` and `requirements.txt` (not only `.git`, `package.json` or `.claude`), so Claude Code, VS Code and Cursor working in a Java, C# or Python project without git write their plans, tests and reports into that project. Claude Desktop and other clients with one global config stay generic (`~/selenium-ai-agent`); `install ... --output-dir=` sets another folder, also for an existing setup, and `install` points to `init-agents` for project work.
- **Projects that already have a `specs/` folder.** Only Markdown with the plan layout (a `Status:` line or `## Test Scenarios`) counts as a test plan; API specs, design notes and unit test specs in the same folder are not listed, served or changed. When the folder holds other files, the agent says so once and suggests a folder of its own: `SELENIUM_MCP_SPECS_DIR=test-plans` (or `--specs-dir=test-plans`). `npx selenium-ai-agent review <folder>` accepts the project folder or the plans folder itself.
- **Review on by default, off for speed.** `SELENIUM_MCP_PLAN_REVIEW=off` (or `--no-plan-review`) lets the generator use plans nobody approved; the tools say so in their results.

## [3.6.0] - 2026-11-22

### New Features

- **The generator uses your project's own stack.** When no framework is named, `generator_setup_page` reads the project's build files (or `projectRoot`) and writes tests in the language and test runner the team already uses: `pom.xml` / `build.gradle` → Java with JUnit 5 or TestNG, `requirements.txt` / `pyproject.toml` / `pytest.ini` → Python with pytest or unittest (new: `selenium-python-unittest`), `*.csproj` → C# with NUnit, xUnit or MSTest, `package.json` → selenium-webdriver with Mocha or Jest, or WebdriverIO, `*.robot` → Robot Framework. It reports what it found (`frameworkSource`, `testRunner`, e.g. "Java with TestNG (pom.xml)"). Python with pytest stays the default for an empty project. `--with-rules` uses the same detection.
- **Selenium 3 → 4 migration.** A new `selenium_rules_check` tool scans existing tests (a folder or one file) in Python, Java, C#, JavaScript/TypeScript, Ruby, Robot Framework and WebdriverIO for outdated or flaky patterns, and lists them per rule and per file with line numbers. A new `selenium-test-migrator` agent (installed by `init-agents`) scans the suite, runs it first as a baseline, rewrites one file at a time (reading the current docs with `get_selenium_docs`; `healer_fix_test` refuses anything still outdated) and proves every file still passes, without changing what the tests check.
- **JetBrains IDEs.** `npx selenium-ai-agent install junie` configures Junie in IntelliJ IDEA, PyCharm and the other JetBrains IDEs (`~/.junie/mcp/mcp.json`), and `--with-rules=junie` adds the rules to Junie's guidelines without hiding existing ones (`.junie/AGENTS.md`, else `.junie/guidelines.md` or `.junie/guidelines/`). The READMEs show the setup for AI Assistant, Junie and GitHub Copilot in JetBrains IDEs.
- **A longer timeout is not a fix.** `healer_fix_test` now compares the fix with the test it replaces and refuses a fix that raises a wait timeout above the test's old maximum (Java `Duration`, C# `TimeSpan`, `WebDriverWait(driver, n)`, JavaScript `driver.wait(…, ms)`, WebdriverIO `{ timeout }`, Robot `timeout=` and `Set Selenium Timeout`). The error says by how much the timeout went up and asks for the condition that was not true yet. New waits, and waits no longer than before, are fine; `allowRuleViolations` writes it anyway when the user explicitly asks. Until now this was only an instruction to the healer agent.
- **C# rules for Selenium 4 .NET.** The rules check now refuses three Selenium 3 APIs that Selenium 4 .NET removed: `new WebDriverWait(driver, 10)` (it takes a `TimeSpan`), `Timeouts().ImplicitlyWait(...)` and `ExpectedConditions` (.NET dropped them; wait with a lambda). The old headless check also catches C#'s `AddArgument("--headless")`.
- **Sample projects.** `examples/java-junit5` (Maven, JUnit 5) and `examples/csharp-nunit` (.NET 8+, NUnit) are small projects to try the agents on: page objects, explicit waits, a test plan with one section left for the generator, and an old Selenium 3 suite for the migrator.

### Fixes

- **`healer_run_tests` passes arguments exactly as given.** The arguments were handed to the shell joined with plain spaces, so `sh -c "cd tests && pytest"` ran only `cd`, and an argument with a space was split in two. Each argument is now quoted for the shell (POSIX quoting on macOS and Linux, double quotes on Windows); plain arguments and a command given as one string work as before.

## [3.5.0] - 2026-11-20

### New Features

- **The generator and healer follow Selenium's official rules for AI agents.** The Selenium project publishes guidance for AI coding assistants ([selenium.dev/documentation/ai_agents](https://www.selenium.dev/documentation/ai_agents/)) and a rules file with examples per language binding (`rust/src/resources/rules.md` in SeleniumHQ/selenium, bundled unchanged, Apache-2.0).
  - `generator_setup_page` returns the rules for the language the tests are written in: the core principles, that language's examples for starting and quitting a browser, locating elements and explicit waits, common expected conditions, common errors and the anti-patterns.
  - `generator_write_test` and `healer_fix_test` check the code against the guidance and do not write a file that breaks it: sleeps (`time.sleep`, `Thread.sleep`, `driver.sleep`, Robot `Sleep`, ...), third-party driver managers and hard-coded driver paths, `DesiredCapabilities`, removed Selenium 3 APIs (`find_element_by_*`, `switch_to_alert`, `findElementBy*`), the old headless API, Java `TimeUnit` timeouts, Grid 3 invocations, and implicit waits mixed with explicit waits. The error lists each line with the rule and how to fix it. Absolute XPath, JavaScript clicks, CDP, `BrowserType` and a lone implicit wait are reported as warnings. `allowRuleViolations` writes the file anyway, only when the user explicitly asks.
  - The generator and healer agents follow the rules; the healer no longer fixes flaky tests with sleeps or longer timeouts, but waits for the condition that was not yet true.
  - **Robot Framework (SeleniumLibrary)** gets Selenium's rules in keywords, from the [SeleniumLibrary keyword docs](https://robotframework.org/SeleniumLibrary/SeleniumLibrary.html): `Sleep` and `Set Selenium Speed` (which SeleniumLibrary says is for demos and debugging, not waiting) are refused, a non-zero implicit wait next to `Wait Until` keywords is an error, the deprecated `desired_capabilities` and `executable_path` arguments and `webdrivermanager` are refused, and absolute XPath and the deprecated `sizzle:` strategy are warnings.
  - **WebdriverIO gets its own rules**, from WebdriverIO's docs ([llms.txt](https://webdriver.io/llms.txt), [AI agents](https://webdriver.io/docs/ai-agents), [best practices](https://webdriver.io/docs/bestpractices), [auto-waiting](https://webdriver.io/docs/autowait), [v9 → v10 migration](https://webdriver.io/docs/v10-migration)), since it is not a Selenium binding. `generator_setup_page` returns them: v10 APIs only, await everything, user-facing selectors first, `expect-webdriverio` matchers, and `$()` matching exactly one element (strict in v10). `browser.pause()` and promise sleeps, the removed sync mode and v4 APIs, and APIs that v10 removed or renamed (`executeAsync`, `switchToFrame`, `toHaveAttr`, `toHaveClass`, `'page load'`, `throttle`, positional `addCommand`/`getCookies`/`getHTML`, ...) are refused; XPath and implicit timeouts are warnings.
  - Playwright tests are not checked.
  - `scripts/update-selenium-rules.mjs` refreshes the bundled rules from the Selenium repository.
- **`get_selenium_docs` reads the current docs.** A new core tool reads Selenium's (or WebdriverIO's) documentation as Markdown from their `llms.txt` indexes: the index itself, a page by URL or path (Selenium pages as `<page>/index.md`, WebdriverIO pages as `<page>.md`), or the best page for a topic such as "explicit waits", with other matches listed. Only selenium.dev and webdriver.io are fetched, pages are cached for a day, and offline it falls back to the bundled rules. The generator and healer agents check the docs before using an API they are not sure of: an API that is not in the current docs does not exist.
- **MCP resources.** The server now offers resources, for clients without web access: `selenium://docs/llms.txt` and `webdriverio://docs/llms.txt` (live, with the bundled rules as fallback), `selenium://rules/selenium.md` (Selenium's rules file) and `selenium://rules/<python|java|javascript|csharp|ruby|robot-framework|webdriverio>`.
- **`--with-rules` puts the rules in your project.** `init-agents --with-rules` and `install <client> --with-rules` write a rules section for every AI tool in the project, as Selenium's guide recommends: `CLAUDE.md`, `.cursor/rules/selenium.mdc`, `.github/copilot-instructions.md`, `.windsurf/rules/selenium.md` or `AGENTS.md` (`--with-rules=claude,agents` picks the files). It names the docs index and examples, says to read the docs before an unfamiliar API, pins the Selenium (or WebdriverIO) version found in `requirements.txt`, `pyproject.toml`, `pom.xml`, `build.gradle` or `package.json`, and lists the required patterns with the language's own notes. The section sits between markers, so running it again replaces only that section; `--framework=` overrides the detected language.

### Fixes

- **No implicit waits in the examples.** The generator agent and `docs/FRAMEWORK_STANDARDS.md` showed `driver.implicitly_wait(10)` next to explicit waits, which Selenium's guidance says never to mix.

## [3.4.2] - 2026-11-20

### Changes

- **Python with pytest is the generator's default.** When the user names no language or framework, the generator writes `selenium-python-pytest` tests instead of asking first; any other language or framework (Java, C#, JavaScript/TypeScript, WebdriverIO, Robot Framework, ...) is used on request. `framework` is now optional in `generator_setup_page` and `generator_write_test`.
- **Documentation for AI assistants.** A root `llms.txt` with the key facts, a summary at the top of both READMEs, and a clearer npm description, keywords and MCP Registry description.

### Fixes

- **`generator_write_test` keeps the run command.** A test saved without `runCommand` no longer replaces a run command set earlier in `.test-manifest.json` (e.g. `.venv/bin/pytest`).

## [3.4.1] - 2026-11-19

### New Features

- **Structured test plans, as in Playwright.** `planner_save_plan` takes the plan structured like Playwright's planner: `name`, `overview`, `suites` (with the `seedFile` they start from) containing `tests` (with the `file` the generated test goes to) and `steps`, each with one action (`perform`) and its own expected results (`expect`). On top of Playwright's format it keeps the `elements` found while exploring (name + locator) and the `gaps` in the application. The server writes the Markdown, so every plan has the same layout (`### 1. Suite`, `**Seed:**`, `#### 1.1. Test`, `**File:**`, `1. step` with `- expect: …` lines under it), names the file after the plan (`specs/shopping-cart-and-checkout.md`) and reports the number of suites, tests and steps. Free-form `planContent` still works. The planner agent saves plans this way, and the generator writes one test per plan test, to its file, with an assertion for every `expect`.

- **Shadow DOM support, as in Playwright.** Elements inside web components (open shadow roots, also nested) are found everywhere, not only in page snapshots:
  - `planner_explore_page` lists their fields, buttons and links, with the component they are in (`shadowHost: "login-form > app-button"`), and counts them.
  - `browser_generate_locator` returns a `host >>> inner` path (`login-form >>> app-button >>> button`) with ready Selenium code that opens each shadow root in turn: `driver.find_element(By.CSS_SELECTOR, 'login-form').shadow_root.find_element(...)` in Python, `getShadowRoot()` in Java and JavaScript. XPath is not offered there, because it cannot enter shadow roots.
  - CSS selectors in `wait_for`, setup steps, `teach_selector`, the healer's locator check and the generator's selector validation also match inside open shadow roots, and accept `host >>> inner` paths.
  - Closed shadow roots stay unreachable, as in Playwright.

### Fixes

- **Better labels in `planner_explore_page` and `browser_generate_locator`.** Labels that are not linked to their field (`<label>` without `for`, as on many React pages) are found; a dropdown's label no longer contains its own options ("AllElectronics…"); icon-font text ("shopping_cart", "login") and `aria-hidden` text are left out of buttons, links and headings; required markers (`*`) are dropped; fields without any label fall back to their name or test id.
- **Pop-ups are explored on their own.** While a dialog or a full-screen overlay is open (also one without `role="dialog"`), the inventory lists only what is inside it, and says so ("Pop-up on page …"), instead of the whole page behind it.

## [3.4.0] - 2026-11-19

### New Features

- **`init-agents`: install the test agents like Playwright's `init-agents`.** `npx selenium-ai-agent init-agents --loop=claude|vscode|copilot|cursor` writes the planner, generator, healer and analyzer agents where each client reads them (`.claude/agents/`, `.github/chatmodes/`, `.github/agents/`, `.cursor/rules/`), with tool names in that client's format (`mcp__<server>__navigate_to`, `<server>/navigate_to`), reuses the server name from the project's MCP config and registers the server when missing. The agent templates now ship in the npm package. The separate `selenium-test-agents` package, which copied the files to an unused `.agents/` folder, is replaced.
- **Planner seed test and setup steps.** `planner_setup_page` takes `seedTest` (its content comes back as the template generated tests follow; default: the seed registered with `generator_write_seed`) and `setupSteps` (`navigate`, `fill`, `click`, `select`, `press`, `wait` with CSS selectors, run in the planner's browser before exploring, e.g. a login). A failing step is reported by number.
- **Plans go to `specs/`.** `planner_save_plan` saves to `specs/` by default, and `generator_read_spec` finds a plan by name there, so the planner's output is the generator's input, as in Playwright.

### Fixes

- **The agent definitions used tools that do not exist.** They listed Playwright MCP names (`browser_navigate`, `browser_click`, `browser_snapshot`, …), so an agent limited to its tool list could not use the browser. They now list this server's tools (a test checks every name against the registry), and the planner and generator instructions describe the seed, the page inventory and the `specs/` hand-off.

### Fixes

- **Saving works in Claude Desktop.** Claude Desktop starts MCP servers in `/`, which made `/` the output folder: test plans, tests, specs and risk profiles went to `/test-plans` etc. and failed, and the path check compared against `//`, so even an explicit folder was "outside the output directory". The check now uses `path.relative` (correct for any root), and when the server runs outside a project (in `/` or the home folder) files go to `~/selenium-ai-agent`. `~` works in `SELENIUM_MCP_OUTPUT_DIR` and `outputDir`. The output folder is logged at start-up and checked by `doctor`.
- **`planner_explore_page` reports the page.** It only counted `<form>` tags, so modern apps came back as "0 forms". It now returns headings, input fields with their labels, test ids, required flag and dropdown options, buttons (with disabled state), links (internal/external) and forms, in one browser round trip.
- **`browser_generate_locator` finds elements from a description.** It matched only literal text ("search box" failed for a field labelled "Search for items") and produced invalid code (`By.css("button[data-testid="x"]")`). It now scores text, label, placeholder, test id, element kind and the surrounding content (so "the Add to Cart button of the Mechanical Keyboard" picks the right one), and returns correctly quoted locators for JavaScript, Python and Java plus alternatives.
- **`healer_inspect_page` suggests replacements** for broken locators, based on the locator's name and old value.
- **`batch_execute` accepts lists and numbers.** Unknown values were described to clients as strings, so tools such as `verify_list_visible` could not run in a batch.
- **`resize_window` `fullscreen`/`maximize` work from a minimized window** (the window is restored first).
- **Clear message without a browser:** "No browser is open yet. Open a page with navigate_to first" instead of "Call ensureBrowser() first".

## [3.3.6] - 2026-11-18

### New Features

- **Window state and position in `resize_window`.** New `state`: `fullscreen` (whole screen and in front, for demos and screen recordings), `maximize`, `minimize` (out of view, so the AI chat or another app shows again) and `normal` (back to the exact size and position from before). New `x`/`y` move the window. Before, the window could only be resized, so an AI could not put the browser in front for a recording or next to another window.

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
