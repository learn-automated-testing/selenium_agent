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
name: bug-fix
description: Structured bug-fix workflow — reproduce, fix root cause, write regression test, deploy. Use when the user says "fix this bug", "there's a bug", "something is broken", or needs a defect resolved through the full pipeline (non-critical).
---

# Workflow: bug fix

## Purpose
Diagnose and fix a reported bug safely, with a regression test so it never comes back.

## Before you start
Read `.claude/state.json`. Resume if a fix is already in progress.

---

## Sequence

### Step 1 — Reproduce
**Skill:** `.claude/skills/debug/SKILL.md`
**Input:** Bug description from user
**Output:** Confirmed reproduction steps + root cause hypothesis in `.claude/state.json`
**Gate:** Bug reproduces consistently before any code is changed
**State update:** `{ "current_step": "fix", "bug": "{description}", "root_cause": "{hypothesis}" }`

Do not touch any code until the bug is reproduced. If it cannot be reproduced, ask the user for more information.

---

### Step 2 — Fix
**Skill:** `.claude/skills/debug/SKILL.md`
**Input:** Reproduction steps + root cause
**Output:** Fix committed. Bug no longer reproduces.
**Gate:** Original bug is gone. No new errors introduced.
**State update:** `{ "current_step": "test", "completed": ["reproduce", "fix"] }`

Fix the root cause only. Do not refactor surrounding code at the same time.

---

### Step 3 — Regression test
**Skill:** `.claude/skills/test/SKILL.md`
**Input:** The bug that was fixed
**Output:** A new test that would have caught this bug. Full suite still passing.
**Gate:** New test passes. Full suite `Failed: 0`.
**State update:** `{ "current_step": "deploy", "completed": ["reproduce", "fix", "test"] }`

The regression test is non-negotiable. No fix ships without it.

---

### Step 4 — Deploy
**Skill:** `.claude/skills/deploy/SKILL.md`
**Input:** Fix + passing tests
**Output:** Fix live on staging, then production
**Gate:** Bug confirmed fixed in production. No regressions.
**State update:** `{ "current_step": "done", "status": "complete" }`

Bug fixes may go direct to production (skipping staging review) if critical.
Still requires passing tests.

---

## Failure handling
If the fix introduces new failures → revert the fix, update state to `blocked`, report to user.

## State file location
`.claude/state.json` in the project repo.
