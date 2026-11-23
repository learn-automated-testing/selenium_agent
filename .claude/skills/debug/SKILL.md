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
name: debug
description: Diagnoses and fixes bugs systematically — reproduces first, forms hypotheses, isolates, fixes root cause, verifies. Use when the user says "it's broken", "this isn't working", "I'm getting an error", "help me fix this", or a test is failing unexpectedly.
---

# Skill: debug

## Purpose
Diagnose and fix bugs systematically — without guessing, without making things worse.

## When to trigger this skill
- User says "it's broken", "this isn't working", "I'm getting an error", "help me fix this"
- A test is failing unexpectedly
- The app crashes or behaves differently than expected
- An AI-generated change introduced a regression

## Prerequisites
- Access to the error message or unexpected behaviour description
- Access to the relevant code
- Ideally: steps to reproduce the bug

## Steps

1. **Get the full error first**
   - Ask for the complete error message and stack trace if not provided
   - Do not guess at the cause from a partial description
   - Check: browser console, server logs, terminal output

2. **Reproduce the bug**
   - Can you make it happen consistently?
   - What are the exact steps?
   - Does it happen in all environments or just one?
   If you can't reproduce it, you can't reliably fix it.

3. **Read the stack trace top to bottom**
   - The first line is usually the error type and message
   - The first line of YOUR code in the trace is where to start looking
   - Ignore framework internals until your own code is ruled out

4. **Form a hypothesis before changing anything**
   - "I think the bug is caused by X because Y"
   - Write this down — it keeps debugging focused
   - If the hypothesis is wrong, update it before trying something else

5. **Isolate the problem**
   - Add targeted `console.log` / `print` statements to confirm assumptions
   - Narrow down: which function, which line, which data value is wrong?
   - Use the smallest possible reproduction — remove everything unrelated

6. **Fix the root cause, not the symptom**
   - Wrapping in try/catch to silence an error is not a fix
   - Understand WHY it's failing, then fix that
   - Common root causes:
     - Async code not awaited
     - Undefined/null not handled
     - Wrong data type (string vs number)
     - Missing environment variable
     - Race condition
     - Stale cache or state

7. **Verify the fix**
   - Reproduce the original bug — confirm it's gone
   - Run the full test suite — confirm nothing else broke
   - Check related code paths — could the same bug exist elsewhere?

8. **Document what you found**
   - Add a comment if the fix is non-obvious
   - If it was caused by AI-generated code, note the pattern to avoid

## Rules and constraints
- Never push a fix without reproducing the bug first
- Never silence an error without understanding it
- Never fix a bug by removing the test that caught it
- If stuck after 3 hypotheses, stop and describe the problem fresh — rubber duck it

## Debugging cheatsheet

| Symptom | First place to check |
|---------|---------------------|
| `undefined is not a function` | The variable is null/undefined — add a guard |
| `Cannot read properties of null` | Object doesn't exist yet — check async timing |
| `404 on API call` | Wrong URL, wrong HTTP method, or route not registered |
| `401 Unauthorized` | Missing or expired auth token |
| `CORS error` | Server not sending correct headers for this origin |
| Works locally, broken in prod | Missing environment variable in prod |
| Works on refresh, broken on nav | Client-side state not reset between routes |

## Output format
```
Bug diagnosis: [short description]
───────────────────────────────────

Root cause:
  The createUser() function was called without await, so the
  database write hadn't completed before the response was sent.

Fix applied:
  Added await on line 34 of userController.js

Verified:
  ✓ Original bug no longer reproduces
  ✓ Full test suite passing (24/24)

Watch out for:
  Same pattern exists in updateUser() on line 67 — fixed that too.
```
