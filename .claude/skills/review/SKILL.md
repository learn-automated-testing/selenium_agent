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
name: review
description: Reviews code for correctness, security, quality, maintainability. Groups findings by severity and suggests fixes. Use when the user says "review this", "check my code", "PR review", "what's wrong with this", or before merging a branch.
---

# Skill: review

## Purpose
Review code for quality, security, maintainability, and correctness. Catch problems before they reach production.

## When to trigger this skill
- User says "review this", "check my code", "PR review", "what's wrong with this"
- Before merging a branch
- After a vibe coding session to catch AI-generated issues
- When code feels fragile or hard to understand

## Prerequisites
- Access to the code to be reviewed
- Understanding of the tech stack in use
- Ideally: access to the feature spec or user story this code implements

## Steps

1. **Understand the intent first**
   - Read the PR description or ask: "What is this code supposed to do?"
   - Review against the spec, not just against itself

2. **Check correctness**
   - Does it actually do what it's supposed to do?
   - Are there obvious logic errors or off-by-one issues?
   - Are edge cases handled: empty arrays, null values, zero, very large numbers?

3. **Check security**
   - User input: is everything validated and sanitised before use?
   - SQL: are queries parameterised? No string concatenation into queries.
   - Auth: are protected routes actually protected?
   - Secrets: no API keys, passwords, or tokens hardcoded or logged
   - Dependencies: any new packages added? Are they well-maintained?

4. **Check code quality**
   - Is the code readable without needing comments to explain it?
   - Are functions small and single-purpose?
   - Is there duplicated logic that should be extracted?
   - Are variable and function names clear and consistent?
   - Is error handling present and meaningful?

5. **Check for regressions**
   - Does this change touch shared utilities or global state?
   - Could it break existing behaviour elsewhere?
   - Are there tests covering the changed code?

6. **Check performance (if relevant)**
   - Any N+1 database queries?
   - Any blocking operations on the main thread?
   - Large data sets handled with pagination?

7. **Deliver the review**
   - Group findings by severity: critical → warning → suggestion
   - Be specific: quote the line, explain the problem, suggest the fix
   - Praise what's done well — this builds trust and signals what to repeat

## Rules and constraints
- Never approve code with a critical security issue
- Never approve code with no error handling on external calls
- Be kind — the goal is better code, not to make someone feel bad
- Focus on patterns, not just individual lines
- Do not rewrite the entire code — flag issues and let the author fix

## Severity levels

| Level | Meaning | Must fix before merge? |
|-------|---------|----------------------|
| Critical | Security hole, data loss risk, broken functionality | Yes |
| Warning | Bad practice, likely future bug, missing error handling | Strongly recommended |
| Suggestion | Style, readability, minor improvements | Optional |

## Output format
```
Code review: UserAuthService.js
───────────────────────────────

CRITICAL (1)
  Line 47: Password is logged to console before hashing.
  This will expose plaintext passwords in your logs.
  Fix: remove console.log(password) on line 47.

WARNING (2)
  Line 23: No error handling on the database call.
  If the DB is down, this will throw an unhandled exception.
  Fix: wrap in try/catch and return a meaningful error response.

  Line 61: Magic number 86400 — what is this?
  Fix: extract to a named constant: TOKEN_EXPIRY_SECONDS = 86400

SUGGESTION (1)
  Line 12-34: This function is doing three things.
  Consider splitting into validateInput(), hashPassword(), saveUser().

Overall: good structure, clean naming. Fix the critical issue before merging.
```
