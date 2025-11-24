# Selenium MCP Test Automation Workflow

This document explains the proper workflow for using the Selenium MCP agents to create automated tests with human review checkpoints.

## Overview

The Selenium MCP server provides three specialized agents that work together in a **three-phase workflow** with **mandatory human review gates**:

1. **Planner Agent** → Creates test plans (with human review required)
2. **Generator Agent** → Generates test code from approved plans
3. **Healer Agent** → Fixes and maintains existing tests

## The Three-Phase Workflow

### Phase 1: Test Planning (Planner Agent)

**Agent**: `selenium-test-planner`

**Purpose**: Explore your web application and create a comprehensive test plan in Markdown format.

**Steps**:
1. Agent explores your web application
2. Agent identifies test scenarios and user flows
3. Agent creates a structured test plan
4. Agent saves the plan to `test-plans/` directory
5. **Agent STOPS and waits for your review** ⚠️

**Your Role**:
- Review the generated test plan
- Verify test scenarios make sense
- Request changes if needed
- **Approve the plan** before proceeding to Phase 2

**Example Usage**:
```
You: "Create a test plan for the shopping cart feature on practiceautomatedtesting.com"

Planner Agent:
- Explores the shopping section
- Identifies filters, sorting, cart operations
- Creates comprehensive test plan
- Saves to test-plans/shopping_test_plan.md
- Presents plan for your review
- WAITS for your approval ✋
```

### Phase 2: Test Code Generation (Generator Agent)

**Agent**: `selenium-test-generator`

**Purpose**: Transform an **approved test plan** into executable test code.

**Prerequisites**:
- ✅ Approved test plan from Phase 1 (or existing test plan)
- ✅ Framework selection (pytest, Robot Framework, etc.)

**Steps**:
1. Agent asks which framework you want to use
2. Agent reads the approved test plan
3. Agent executes each scenario on the live application
4. Agent captures element locators and interactions
5. Agent generates test code in your chosen framework
6. **Agent detects existing test structure** (if any)
7. **Agent asks where to save the test file** ⚠️ MANDATORY
8. **You approve the save location** ✋
9. Agent saves tests to your confirmed location

**Your Role**:
- Provide the approved test plan (file path or content)
- Select your preferred test framework
- **Approve the file save location** (new requirement)
- Review the generated test code

**Example Usage**:
```
You: "Generate Robot Framework tests from test-plans/shopping_test_plan.md"

Generator Agent:
- Asks: "Which framework? (pytest/robot/unittest/webdriverio)"

You: "Robot Framework"

Generator Agent:
- Executes each test scenario on live site
- Captures selectors and generates .robot files
- Detects existing test structure
- Asks: "I've generated Robot Framework test code with 12 test cases.

  Detected structure:
  - Found existing tests in: tests/
  - Existing files: test_login.robot, test_checkout.robot

  Where would you like me to save this file?
  1. tests/test_shopping.robot (matches existing structure) ← RECOMMENDED
  2. tests/e2e/test_shopping.robot (framework standard)
  3. Custom location (please specify)"

You: "Option 1"

Generator Agent:
- Saves to tests/test_shopping.robot
- Confirms: "✅ Saved to tests/test_shopping.robot"
```

### Phase 3: Test Maintenance (Healer Agent)

**Agent**: `selenium-test-healer`

**Purpose**: Debug, fix, and maintain existing test suites.

**When to Use**:
- Tests are failing after application changes
- Need to update element selectors
- Want to improve test reliability

**Steps**:
1. Agent runs your test suite
2. Agent identifies failures
3. Agent debugs failing tests
4. Agent suggests and applies fixes
5. Agent verifies fixes work

**Example Usage**:
```
You: "Fix the failing tests in tests/test_shopping.robot"

Healer Agent:
- Runs the test suite
- Identifies 3 failing tests
- Debugs each failure (element not found, etc.)
- Suggests fixes (updated selectors)
- Applies fixes and re-runs tests
- Confirms all tests pass ✅
```

## Critical Rules

### ⚠️ MANDATORY HUMAN REVIEW GATES

1. **After Test Planning** (Phase 1):
   - Planner agent MUST stop after saving the test plan
   - Planner agent MUST present the plan for review
   - Planner agent MUST NOT proceed to code generation
   - **You MUST review and approve** before moving to Phase 2

2. **Before Code Generation** (Phase 2 Start):
   - Generator agent requires an **approved test plan**
   - Generator agent MUST ask for framework preference
   - **You MUST provide explicit approval** to proceed

3. **Before Saving Test Files** (Phase 2 End) - **NEW**:
   - Generator agent MUST detect existing test structure
   - Generator agent MUST present save location options
   - **You MUST approve the save location** before files are written
   - Generator respects your choice (existing structure, standard, or custom)

4. **After Code Generation** (Recommended):
   - **You should review** the generated test code
   - Verify selectors and assertions make sense
   - Run the tests to ensure they work

### Why Human Review is Required

1. **Quality Control**: Ensure test scenarios align with business requirements
2. **Accuracy**: Verify the agent understood the application correctly
3. **Coverage**: Confirm all critical paths are tested
4. **Efficiency**: Prevent wasted effort generating code from flawed plans
5. **Maintainability**: Review ensures tests will be maintainable long-term

## Complete Example Workflow

### Scenario: Testing a Shopping Cart Feature

```markdown
## Phase 1: Planning

You: "Create a comprehensive test plan for the shopping cart on
     practiceautomatedtesting.com/shopping"

Planner Agent:
✅ Navigating to site...
✅ Exploring shopping features...
✅ Discovering filters, sorting, cart operations...
✅ Creating test plan with 15 scenarios...
✅ Saved to: test-plans/shopping_cart_test_plan.md

📋 Test Plan Summary:
- Category Filters (5 tests)
- Search Functionality (3 tests)
- Cart Operations (4 tests)
- Checkout Flow (3 tests)

⏸️ STOPPED - Please review the test plan. Would you like to:
1. Approve and proceed to code generation
2. Request changes to the plan
3. Add/remove specific scenarios

---

## Review Period (You Review the Plan)

You: Opens test-plans/shopping_cart_test_plan.md
You: Reviews scenarios, makes notes
You: "The plan looks good, but add a test for empty cart validation"

Planner Agent:
✅ Adding test scenario: Empty Cart Validation
✅ Updated test-plans/shopping_cart_test_plan.md

⏸️ STOPPED - Plan updated. Please review again.

You: "Perfect! Approve the plan."

---

## Phase 2: Code Generation

You: "Generate Robot Framework tests from the approved plan
     at test-plans/shopping_cart_test_plan.md"

Generator Agent:
❓ Which test framework would you like?
   - selenium-python-pytest
   - selenium-python-unittest
   - webdriverio-js
   - webdriverio-ts
   - robot-framework

You: "robot-framework"

Generator Agent:
✅ Initializing test generation session...
✅ Reading test plan...
✅ Executing Scenario 1: Category Filter - Electronics...
✅ Capturing selectors...
✅ Executing Scenario 2: Category Filter - Accessories...
... (continues for all 16 scenarios)
✅ Generated test code
✅ Saved to: tests/test_shopping_cart.robot

📝 Generated 16 test cases with 127 lines of code

---

## Phase 3: Running & Healing (Optional)

You: "Run the generated tests"

You (via terminal): robot tests/test_shopping_cart.robot

Result: 14 passed, 2 failed

You: "Fix the failing tests"

Healer Agent:
✅ Running test suite...
⚠️ Found 2 failures:
   - TC_007: Element not found (selector changed)
   - TC_012: Timeout waiting for page load
✅ Debugging TC_007...
✅ Found new selector for "Add to Cart" button
✅ Applying fix...
✅ Debugging TC_012...
✅ Increased wait timeout from 5s to 10s
✅ Applied fixes
✅ Re-running tests...
✅ All tests pass! (16/16)
```

## Best Practices

### For Test Planning
1. Be specific about what you want to test
2. Provide context about critical user flows
3. Review plans thoroughly before approval
4. Request changes if scenarios are missing
5. Consider edge cases and error scenarios

### For Code Generation
1. Always start with an approved plan
2. Choose the framework you're most comfortable maintaining
3. Review generated code for:
   - Proper waits (not hard sleeps)
   - Reliable selectors (ID > CSS > XPath)
   - Clear assertions
   - Good test structure
4. Run tests immediately after generation

### For Test Maintenance
1. Keep tests independent (no dependencies between tests)
2. Use the Healer agent for systematic debugging
3. Update test plans when application changes
4. Re-generate tests when plans change significantly

## Common Mistakes to Avoid

❌ **DON'T**: Skip the planning phase and jump to code generation
✅ **DO**: Always create a test plan first

❌ **DON'T**: Approve plans without reviewing them
✅ **DO**: Read and verify test scenarios match requirements

❌ **DON'T**: Generate code without specifying framework
✅ **DO**: Explicitly choose your test framework

❌ **DON'T**: Ignore test failures after generation
✅ **DO**: Run and fix tests immediately

❌ **DON'T**: Manually fix tests without updating the plan
✅ **DO**: Update test plans when requirements change

## Agent Communication Examples

### Planner Agent (Correct Behavior)
```
✅ GOOD:
"I've completed the test plan and saved it to test-plans/shopping.md.

 The plan includes 12 test scenarios covering filters, search, and cart.

 Please review the test plan. Would you like to:
 1. Approve this plan and proceed to test code generation
 2. Request changes to the test plan
 3. Add or remove specific scenarios"

❌ BAD:
"Test plan complete. Generating pytest code now..."
(This skips human review!)
```

### Generator Agent (Correct Behavior)
```
✅ GOOD:
"I need an approved test plan to generate tests. Please either:
 1. Use selenium-test-planner agent to create a plan, or
 2. Provide an existing test plan file path"

❌ BAD:
"Sure, I'll create tests for your shopping cart right away!"
(This skips the planning phase!)
```

## Troubleshooting

### "Agent generated code without my review"
**Solution**: This shouldn't happen anymore. The planner agent has been updated to always stop and wait for review. If it still happens, the agent instructions may need to be reinforced.

### "Generator agent won't start"
**Reason**: Generator agent requires an approved test plan first.
**Solution**: Complete Phase 1 (planning) and approve the plan before using the generator agent.

### "Tests are failing after generation"
**Solution**: Use the Healer agent (Phase 3) to debug and fix the tests systematically.

## Summary

```
Phase 1: PLAN    → selenium-test-planner   → Generates test plan    → ⏸️ HUMAN REVIEW
                                                                       ↓
Phase 2: GENERATE → selenium-test-generator → Generates test code    → ⏸️ HUMAN REVIEW
                                                                       ↓
Phase 3: MAINTAIN → selenium-test-healer    → Fixes failing tests    → ✅ DONE
```

**Remember**: Each phase has a purpose. The review gates ensure quality and prevent wasted effort. Always follow the workflow!
