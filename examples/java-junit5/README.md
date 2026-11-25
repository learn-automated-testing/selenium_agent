# Java sample: Selenium 4 + JUnit 5 with Selenium AI Agent

A small, ready-to-run Java project to try [selenium-ai-agent](https://www.npmjs.com/package/selenium-ai-agent) on. It tests the practice site [the-internet.herokuapp.com](https://the-internet.herokuapp.com) and follows [Selenium's rules for AI agents](https://www.selenium.dev/documentation/ai_agents/):

- **Page objects** (`src/test/java/.../pages`): locators and actions live in the page, assertions stay in the test.
- **Explicit waits only**: no `Thread.sleep`, no implicit waits.
- **Selenium Manager** finds the browser driver: no driver downloads or `webdriver.chrome.driver` paths.
- **One fresh browser per test**, closed in teardown.

```text
examples/java-junit5/
├── pom.xml                      Selenium 4.53, JUnit 5, Java 17+
├── specs/the-internet.md        the test plan (section 4 has no test yet)
├── src/test/java/com/example/theinternet/
│   ├── BaseTest.java            browser per test
│   ├── LoginTest.java           plan 1.1–1.3
│   ├── DynamicLoadingTest.java  plan 2.1–2.2
│   ├── CheckboxesTest.java      plan 3.1
│   └── pages/                   BasePage, LoginPage, SecureAreaPage, DynamicLoadingPage, CheckboxesPage
└── legacy-selenium3/            an old Selenium 3 suite that no longer compiles: for the migrator
```

## Run it

You need Java 17+, Maven and Chrome.

```bash
cd examples/java-junit5
mvn test               # opens Chrome for each test
HEADLESS=1 mvn test    # without a window
```

Expected result: `Tests run: 6, Failures: 0, Errors: 0`.

## Use it with the AI agent

Add the MCP server to your assistant (Node.js 20+ needed for `npx`).

| Assistant | Setup |
|---|---|
| Claude Code | `claude mcp add selenium-ai-agent -- npx -y selenium-ai-agent` |
| IntelliJ IDEA (Junie) | `npx selenium-ai-agent install junie` |
| IntelliJ IDEA (AI Assistant, Copilot) | see [JetBrains IDEs](../../selenium-mcp-server/README.md#jetbrains-ides-intellij-idea-pycharm-webstorm-) |
| VS Code, Cursor, Windsurf | see the [main README](../../README.md) |

Then, in this folder, install the agents and Selenium's rules for your assistant:

```bash
npx selenium-ai-agent init-agents --loop=claude --with-rules     # Claude Code: .claude/agents + CLAUDE.md
npx selenium-ai-agent install junie --with-rules                 # Junie: Selenium's rules in .junie/
```

The generator reads `pom.xml` and writes Java with JUnit 5, in the style of this project (version 3.6.0 and later; on older versions add "in Java with JUnit 5" to your prompt).

### 1. Generate the missing test

Section 4 of the plan has no test yet. Ask:

> Use the selenium-test-generator agent to write a test for section 4 of specs/the-internet.md. Use a page object, like the other tests.

The agent opens the page in a browser, checks the real locators, writes `DropdownPage.java` and `DropdownTest.java`, and refuses code that breaks Selenium's rules (a `Thread.sleep`, a hard-coded driver path, ...). Run `mvn test` again: 7 tests.

### 2. Heal a broken test

Break a locator, for example `By.id("flash")` in `LoginPage.java` to `By.id("flash-message")`, then ask:

> Use the selenium-test-healer agent to run the tests and fix what fails.

It runs `mvn test`, opens the failing page, finds the right locator and fixes it, without sleeps or longer timeouts.

### 3. Migrate a Selenium 3 suite

`legacy-selenium3/` is a typical old suite with TestNG: `new WebDriverWait(driver, 10)`, `implicitlyWait(10, TimeUnit.SECONDS)`, `setHeadless`, `System.setProperty("webdriver.chrome.driver", ...)`, `Thread.sleep` and an absolute XPath. On Selenium 4 it does not compile:

```bash
cd legacy-selenium3 && mvn test    # BUILD FAILURE: int cannot be converted to java.time.Duration
```

Ask:

> Use the selenium-test-migrator agent to migrate legacy-selenium3 to Selenium 4.

It scans the suite with `selenium_rules_check` (5 errors, 2 warnings), runs it as a baseline, migrates one file at a time, and runs it again: `Tests run: 2, Failures: 0`, `BUILD SUCCESS`. What each test checks stays the same.

## Credentials

The login tests use `tomsmith` / `SuperSecretPassword!`, the practice credentials that the-internet shows on its own login page. They are not secrets.
