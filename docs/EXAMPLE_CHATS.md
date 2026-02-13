# Example Chats

Copy-paste these prompts into your AI assistant (Claude Code, Cursor, Copilot, etc.) after [configuring the MCP server](MCP_CLIENT_SETUP.md).

---

## Example 1: Quick Start — Navigate & Screenshot

The simplest interaction. No framework or Grid required.

**You say:**
> Go to https://practiceautomatedtesting.com and take a screenshot

**What happens:**
1. `navigate_to` — opens the URL in a local Chrome browser
2. `take_screenshot` — captures the full page

**AI responds:**
> I navigated to practiceautomatedtesting.com and took a screenshot. The page shows an e-commerce storefront with a navigation bar, featured products section, and a footer. Here's the screenshot:
>
> *(screenshot displayed inline or saved to `screenshots/` depending on output mode)*

---

## Example 2: Explore & Create Test Plan

Use the **Planner** agent to map a user flow and produce a structured test plan.

**You say:**
> Explore the checkout flow at https://practiceautomatedtesting.com and create a test plan

**What happens:**
1. `planner_setup_page` — navigates to the site, captures the initial page snapshot
2. `planner_explore_page` — explores the homepage, discovers links to products
3. `planner_explore_page` — follows the product → add-to-cart → cart page flow
4. `planner_explore_page` — continues through checkout, captures form fields and validation
5. `planner_save_plan` — writes the test plan to a markdown file

**AI responds:**
> I explored the checkout flow across 4 pages and saved a test plan to `test-plans/checkout-flow.md`. The plan covers:
>
> - **6 test scenarios**: add to cart, update quantity, remove item, checkout form validation, successful order, empty cart edge case
> - **Key selectors** identified for each interaction
> - **Risk areas**: payment form validation, session timeout during checkout
>
> Please review the plan before I generate test code.

---

## Example 3: Generate WebdriverIO Tests

Use the **Generator** agent to record interactions and produce WebdriverIO TypeScript tests.

**You say:**
> Generate WebdriverIO tests for the login flow at https://practiceautomatedtesting.com

**What happens:**
1. Initializes the project if needed — `npm init`, installs `@wdio/cli`, creates `wdio.conf.ts`
2. `generator_setup_page` — opens the site with `framework: "webdriverio-ts"`, starts recording
3. `navigate_to` — goes to the login page
4. `input_text` — types a username into the email field
5. `input_text` — types a password into the password field
6. `click_element` — clicks the login button
7. `verify_text_visible` — confirms the success message appears
8. `stop_recording` — ends the recording session
9. `generator_write_test` — generates a `.test.ts` file from the recorded steps

**AI responds:**
> I set up a WebdriverIO project, recorded the login flow, and generated `tests/login.test.ts`:
>
> ```typescript
> import { browser, expect } from '@wdio/globals';
>
> describe('Login Flow', () => {
>   it('should log in with valid credentials', async () => {
>     await browser.url('https://practiceautomatedtesting.com/login');
>
>     const emailInput = await $('[data-testid="email"]');
>     await emailInput.setValue('user@example.com');
>
>     const passwordInput = await $('[data-testid="password"]');
>     await passwordInput.setValue('password123');
>
>     const loginBtn = await $('[data-testid="login-button"]');
>     await loginBtn.click();
>
>     const welcome = await $('[data-testid="welcome-message"]');
>     await expect(welcome).toBeDisplayed();
>   });
> });
> ```
>
> A `.test-manifest.json` was also created to track this test's metadata (framework, selectors, base URL). Run with:
> ```bash
> npx wdio run wdio.conf.ts
> ```

---

## Example 4: Generate Playwright Tests

Same recording workflow, different framework output.

**You say:**
> Create Playwright tests for the product search feature at https://practiceautomatedtesting.com

**What happens:**
1. Initializes the project if needed — `npm init`, installs `@playwright/test`, runs `npx playwright install`
2. `generator_setup_page` — opens the site with `framework: "playwright-js"`, starts recording
3. `navigate_to` — goes to the products page
4. `input_text` — types a search query
5. `click_element` — clicks the search button
6. `verify_text_visible` — confirms search results appear
7. `stop_recording` — ends the recording session
8. `generator_write_test` — generates a Playwright test file

**AI responds:**
> I set up a Playwright project, recorded the product search flow, and generated `tests/product-search.spec.js`:
>
> ```javascript
> const { test, expect } = require('@playwright/test');
>
> test('should search for products and display results', async ({ page }) => {
>   await page.goto('https://practiceautomatedtesting.com/products');
>
>   await page.locator('[data-testid="search-input"]').fill('laptop');
>   await page.locator('[data-testid="search-button"]').click();
>
>   await expect(page.locator('[data-testid="results-count"]')).toBeVisible();
>   await expect(page.locator('.product-card')).toHaveCount(3);
> });
> ```
>
> Run with:
> ```bash
> npx playwright test
> ```

---

## Example 5: Generate Selenium Python (pytest) Tests

Python output using the `selenium-python-pytest` framework.

**You say:**
> Generate pytest Selenium tests for the registration form at https://practiceautomatedtesting.com

**What happens:**
1. Sets up the project if needed — creates `venv`, installs `selenium` and `pytest` via pip
2. `generator_setup_page` — opens the site with `framework: "selenium-python-pytest"`, starts recording
3. `navigate_to` — goes to the registration page
4. `input_text` — fills in name, email, password fields
5. `click_element` — submits the form
6. `verify_text_visible` — confirms success message
7. `stop_recording` — ends the recording session
8. `generator_write_test` — generates a pytest file

**AI responds:**
> I set up a Python virtual environment with selenium and pytest, recorded the registration flow, and generated `tests/test_registration.py`:
>
> ```python
> import pytest
> from selenium.webdriver.common.by import By
> from selenium.webdriver.support.ui import WebDriverWait
> from selenium.webdriver.support import expected_conditions as EC
>
>
> class TestRegistration:
>     def test_register_new_user(self, driver):
>         driver.get("https://practiceautomatedtesting.com/register")
>
>         driver.find_element(By.CSS_SELECTOR, '[data-testid="name"]').send_keys("Jane Doe")
>         driver.find_element(By.CSS_SELECTOR, '[data-testid="email"]').send_keys("jane@example.com")
>         driver.find_element(By.CSS_SELECTOR, '[data-testid="password"]').send_keys("SecurePass123!")
>
>         driver.find_element(By.CSS_SELECTOR, '[data-testid="register-button"]').click()
>
>         wait = WebDriverWait(driver, 10)
>         success = wait.until(
>             EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-testid="success-message"]'))
>         )
>         assert "Welcome" in success.text
> ```
>
> Run with:
> ```bash
> pytest tests/test_registration.py -v
> ```

---

## Example 6: Run Tests & Heal Failures

Use the **Healer** agent to run tests, diagnose failures, and auto-fix them.

**You say:**
> Run my tests and fix any failures

**What happens:**
1. `healer_run_tests` — executes the test suite; 1 of 3 tests fails
2. `healer_debug_test` — analyzes the failure (stale selector `#old-login-btn` no longer exists)
3. `healer_inspect_page` — opens the page to find the correct selector
4. `healer_fix_test` — updates the selector to `[data-testid="login-button"]` in the test file
5. `healer_run_tests` — re-runs the suite; all 3 tests pass

**AI responds:**
> I ran your test suite and found 1 failure:
>
> - **`test_login`** failed — selector `#old-login-btn` not found on the page
>
> I inspected the login page and found the button now uses `[data-testid="login-button"]`. I updated the test file and re-ran the suite:
>
> ```
> 3 passed, 0 failed
> ```
>
> The fix was a selector update in `tests/test_login.py` line 14.

---

## Example 7: Parallel Grid Exploration

Use Selenium Grid to explore multiple sections simultaneously. Requires [Grid setup](../README.md#parallel-exploration-with-selenium-grid).

**You say:**
> Explore the entire site at https://practiceautomatedtesting.com in parallel using 4 browsers

**What happens:**
1. `parallel_explore` — spins up 4 Grid sessions, each exploring a different section:
   - Session 1: Homepage (`/`)
   - Session 2: Products (`/products`)
   - Session 3: Cart & Checkout (`/cart`)
   - Session 4: Account & Auth (`/login`, `/register`)
2. `exploration_merge` — combines all 4 exploration results into a single site map
3. `planner_generate_plan` — produces a comprehensive test plan from the merged data

**AI responds:**
> I explored the site in parallel using 4 browsers on your Selenium Grid:
>
> | Session | Section | Pages Found | Elements |
> |---------|---------|-------------|----------|
> | 1 | Homepage | 3 | 42 |
> | 2 | Products | 8 | 156 |
> | 3 | Cart & Checkout | 4 | 67 |
> | 4 | Account & Auth | 3 | 38 |
>
> **Total: 18 unique pages, 303 interactive elements** discovered in ~12 seconds (vs ~45 seconds sequentially).
>
> I merged the results and generated a test plan covering all sections. Saved to `test-plans/full-site-plan.md`.

---

## Tips

- **Start simple** — Example 1 verifies your setup works before trying complex workflows.
- **Review plans before generating** — The Planner creates a plan for human review. Approve it, then ask for test generation.
- **Pick your framework** — The Generator supports 14 frameworks including `webdriverio-ts`, `playwright-js`, `selenium-python-pytest`, `robot-framework`, `selenium-java-maven`, and more. Just ask for the one you want.
- **Healing is iterative** — The Healer can fix selectors, add waits, and update assertions. Run it after CI failures too.
- **Grid is optional** — Examples 1–6 work with a local browser. Only Example 7 requires Selenium Grid.
