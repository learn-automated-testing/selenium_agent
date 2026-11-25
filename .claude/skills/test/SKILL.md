<!-- skillsrepo:detected-stack:start -->
## Detected stack for this project

- Project: `selenium-ai-agent`
- Primary language: `typescript`
- Test framework: `mocha` (user-selected)
- Deploy target: `docker`, `docker-compose`
- Available MCPs: `skillsrepo`
- Primary user: Developers, QA Engineers, and DevOps/SRE teams
- Domain: AI-driven browser automation — MCP server enabling AI agents to control browsers via Selenium

Read `.claude/context.md` for the full project context. This section is maintained by skillsrepo — edits between the markers will be overwritten on the next refinement.
<!-- skillsrepo:detected-stack:end -->

---
name: test
description: Writes, runs, and reports on tests for any feature or codebase. Detects the test framework, writes missing tests, runs the suite, and reports failures clearly. Use when the user says "run tests", "write tests", "test this", "check if this works", or before any deployment.
---

# Skill: test

## Purpose
Write, run, and report on tests for any feature or codebase. Ensures nothing ships broken.

## When to trigger this skill
- User says "run tests", "write tests", "test this", "check if this works"
- A feature has just been built and needs validation
- A bug has been fixed and regression tests are needed
- Before any deployment step

## Prerequisites
- Codebase is accessible
- Test runner is installed (jest, pytest, vitest, etc. — detect from package.json or requirements.txt)
- Environment variables are set if tests hit external services

## Steps

1. **Detect the test framework**
   - Check `package.json` for jest, vitest, mocha
   - Check `requirements.txt` or `pyproject.toml` for pytest
   - Check `go.mod` for Go test
   - If none found, ask the user before proceeding

2. **Identify what to test**
   - If a specific file or feature is mentioned, scope tests to that
   - Otherwise run the full test suite

3. **Write missing tests first** (if asked)
   - Unit tests for pure functions and utilities
   - Integration tests for API endpoints and database interactions
   - One happy path + at least one failure case per function
   - Keep tests independent — no shared state between tests

4. **Run the tests**
   ```bash
   # JavaScript
   npm test
   # or
   npx vitest run

   # Python
   pytest -v

   # Go
   go test ./...
   ```

5. **Report results clearly**
   - How many passed / failed / skipped
   - Full error output for any failures
   - Which files were affected

6. **Fix failures before moving on**
   - Do not proceed to deploy if tests are failing
   - Fix the root cause, not just the test assertion

## Rules and constraints
- Never delete or skip a test to make the suite pass
- Never mock away the thing being tested
- Always run the full suite after fixing a failure to check for regressions
- Do not deploy if any test is failing

## Output format
```
Test run complete
─────────────────
Passed:  24
Failed:  2
Skipped: 1

Failed tests:
  ✗ auth.test.js > login > should reject invalid password
    Expected 401, received 200

  ✗ cart.test.js > checkout > should apply discount code
    TypeError: discount is not a function

Next step: fix failures above before deploying.
```
