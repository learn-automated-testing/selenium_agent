# C# sample: Selenium 4 + NUnit with Selenium AI Agent

A small, ready-to-run C# project to try [selenium-ai-agent](https://www.npmjs.com/package/selenium-ai-agent) on. It tests the practice site [the-internet.herokuapp.com](https://the-internet.herokuapp.com) and follows [Selenium's rules for AI agents](https://www.selenium.dev/documentation/ai_agents/):

- **Page objects** (`Pages/`): locators and actions live in the page, assertions stay in the test.
- **Explicit waits only**, written as lambdas: `Wait.Until(d => ...)`. Selenium 4 .NET has no `ExpectedConditions`, no `Thread.Sleep` and no implicit waits.
- **Selenium Manager** finds the browser driver: no driver downloads or driver folders.
- **One fresh browser per test**, ended with `Quit()` in teardown.

```text
examples/csharp-nunit/
├── SeleniumAiAgent.Sample.csproj   .NET 8+, Selenium 4.53, NUnit 5
├── specs/the-internet.md           the test plan (section 4 has no test yet)
├── BaseTest.cs                     browser per test
├── Tests/
│   ├── LoginTests.cs               plan 1.1–1.3
│   ├── DynamicLoadingTests.cs      plan 2.1–2.2
│   └── CheckboxesTests.cs          plan 3.1
├── Pages/                          BasePage, LoginPage, SecureAreaPage, DynamicLoadingPage, CheckboxesPage
└── legacy-selenium3/               an old Selenium 3 suite that no longer compiles: for the migrator
```

## Run it

You need the .NET SDK (8 or later) and Chrome.

```bash
cd examples/csharp-nunit
dotnet test              # opens Chrome for each test
HEADLESS=1 dotnet test   # without a window (PowerShell: $env:HEADLESS=1; dotnet test)
```

Expected result: `Passed! - Failed: 0, Passed: 6`.

## Use it with the AI agent

Add the MCP server to your assistant (Node.js 18+ needed for `npx`).

| Assistant | Setup |
|---|---|
| Claude Code | `claude mcp add selenium-mcp -- npx -y selenium-ai-agent` |
| Visual Studio, VS Code (GitHub Copilot) | see the [main README](../../README.md) |
| Rider (Junie) | `npx selenium-ai-agent install junie` |
| Rider (AI Assistant, Copilot) | see [JetBrains IDEs](../../selenium-mcp-server/README.md#jetbrains-ides-intellij-idea-pycharm-webstorm-) |

Then, in this folder, install the agents and Selenium's rules for your assistant:

```bash
npx selenium-ai-agent init-agents --loop=claude --with-rules     # Claude Code: .claude/agents + CLAUDE.md
npx selenium-ai-agent install junie --with-rules                 # Junie: Selenium's rules in .junie/
```

The generator reads the `.csproj` and writes C# with NUnit, in the style of this project (version 3.6.0 and later; on older versions add "in C# with NUnit" to your prompt).

### 1. Generate the missing test

Section 4 of the plan has no test yet. Ask:

> Use the selenium-test-generator agent to write a test for section 4 of specs/the-internet.md. Use a page object, like the other tests.

The agent opens the page in a browser, checks the real locators, writes `Pages/DropdownPage.cs` and `Tests/DropdownTests.cs`, and refuses code that breaks Selenium's rules (a `Thread.Sleep`, a driver folder, `ExpectedConditions`, ...). Run `dotnet test` again: 7 tests.

### 2. Heal a broken test

Break a locator, for example `By.Id("flash")` in `Pages/LoginPage.cs` to `By.Id("flash-message")`, then ask:

> Use the selenium-test-healer agent to run the tests and fix what fails.

It runs `dotnet test`, opens the failing page, finds the right locator and fixes it. It won't fix a failure with a sleep or a longer timeout: `healer_fix_test` refuses a fix that raises a wait above the test's old timeout, and asks which condition wasn't true yet.

### 3. Migrate a Selenium 3 suite

`legacy-selenium3/` is a typical old suite:
- `ExpectedConditions` and `FindElementById(...)`
- `Timeouts().ImplicitlyWait(...)`, `AddAdditionalCapability`
- the old `--headless`, a driver folder in `new ChromeDriver("/usr/local/bin", ...)`
- `Thread.Sleep`, an absolute XPath and `Close()` instead of `Quit()`

On Selenium 4 it does not compile:

```bash
cd legacy-selenium3 && dotnet test    # 5 errors, e.g. CS0103: The name 'ExpectedConditions' does not exist
```

Ask:

> Use the selenium-test-migrator agent to migrate legacy-selenium3 to Selenium 4.

It scans the suite with `selenium_rules_check` (8 errors, 2 warnings), runs it as a baseline, migrates one file at a time and runs it again: `Passed! - Failed: 0, Passed: 2`. What each test checks stays the same.

## Credentials

The login tests use `tomsmith` / `SuperSecretPassword!`, the practice credentials that the-internet shows on its own login page. They are not secrets.
