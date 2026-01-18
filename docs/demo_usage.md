# Selenium MCP Server - Usage Demo

## Once Claude Code/Desktop loads the MCP server, you can use it like this:

### Basic Browser Automation
```
User: Navigate to https://example.com
Assistant: [Uses navigate_to tool] Navigated to https://example.com

User: Take a screenshot
Assistant: [Uses take_screenshot tool] Screenshot saved to screenshots/example_com.png

User: Click the "More information" link
Assistant: [Uses capture_page and click_element tools] Clicked the link
```

### AI Test Agents

#### Planner Agent
```
User: Create a test plan for the login feature at https://myapp.com/login
Assistant: [Uses planner_setup_page and planner_save_plan]
Created comprehensive test plan with:
- Valid login scenario
- Invalid credentials scenario
- Password reset flow
- Remember me functionality
Saved to: test-plans/login-feature.plan.md
```

#### Generator Agent
```
User: Generate pytest tests from the login test plan
Assistant: [Uses generator_setup_page, browser navigation, generator_write_test]
Generated working pytest code with:
- Proper waits and assertions
- Page object pattern
- Fixtures for browser setup
Saved to: tests/test_login.py
```

#### Healer Agent
```
User: Fix the failing tests in tests/test_login.py
Assistant: [Uses healer_run_tests, healer_debug_test, healer_fix_test]
Found 3 failing tests:
1. test_valid_login - Fixed: Updated selector from ID to CSS
2. test_invalid_creds - Fixed: Added explicit wait
3. test_password_reset - Fixed: Updated assertion
All tests now pass! ✅
```

### Available Tools (46 total):

**Navigation (3):**
- navigate_to, go_back, go_forward

**Element Interactions (4):**
- click_element, hover_element, input_text, select_option

**Mouse & Keyboard (4):**
- mouse_click, mouse_drag, mouse_move, key_press

**Verification (4):**
- browser_verify_element_visible
- browser_verify_text_visible
- browser_verify_value
- browser_verify_list_visible

**Agent Tools (8):**
- Planner: planner_setup_page, planner_save_plan
- Generator: generator_setup_page, generator_read_log, generator_write_test
- Healer: healer_run_tests, healer_debug_test, healer_fix_test

**And 23 more tools for:**
- Tab management
- JavaScript execution
- File uploads
- Dialog handling
- Network monitoring
- Console logs
- Recording
- PDF generation
- Wait conditions
- Browser management

