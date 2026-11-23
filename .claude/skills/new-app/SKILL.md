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
name: new-app
description: End-to-end new-app bootstrap workflow — PRD, data model, scaffold, migrations, build, test, deploy. Use when the user says "start a new project", "build me an app", "new app from scratch", or is starting a greenfield repo.
---

# Workflow: new app

## Purpose
Bootstrap a brand new application from scratch — from idea to first deployed version.
Use this workflow at the very start of a new project, before any code exists.

## Before you start
This workflow creates a new project repo. There is no existing state to resume.
Create `.claude/state.json` in the new project as the first action.

---

## Sequence

### Step 1 — PRD
**Skill:** `.claude/skills/prd/SKILL.md`
**Input:** App idea from user
**Output:** `docs/requirements/PRD-001-v1/PRD-001-v1.md` — vision, capabilities (one-liners), success metrics. **No detailed user stories or ACs at this level.**
**Gate:** User confirms: goal, users, capabilities, and out-of-scope are all correct
**State update:** `{ "current_step": "epic", "completed": ["prd"] }`

Take extra time here. A bad PRD means building the wrong thing.
Ask clarifying questions until the following are crystal clear:
- Who is this for and what problem does it solve?
- What are the 3-5 must-have capabilities for v1?
- What is explicitly out of scope?
- What does the tech stack look like?

---

### Step 1a — Epic decomposition
**Skill:** `.claude/skills/epic/SKILL.md`
**Input:** Confirmed PRD from step 1
**Output:** One or more `docs/requirements/PRD-001-v1/EPIC-NNN-<slug>/EPIC-NNN-<slug>.md` — coherent slices of v1, each with scope + testing-scope decision
**Gate:** User has confirmed the slice boundaries. Testing-scope answered for every epic before stories are written.
**State update:** `{ "current_step": "user-story", "completed": ["prd", "epic"] }`

---

### Step 1b — User stories
**Skill:** `.claude/skills/user-story/SKILL.md`
**Input:** Confirmed epic(s) from step 1a
**Output:** `docs/requirements/PRD-001-v1/EPIC-NNN-<slug>/US-NNN-<slug>.md` — one per buildable unit, with acceptance criteria + chosen test frameworks
**Gate:** Every must-have story for v1 has `status: ready` and confirmed ACs.
**State update:** `{ "current_step": "data-model", "completed": ["prd", "epic", "user-story"] }`

---

### Step 2 — Data model design
**Skill:** `.claude/skills/db/SKILL.md`
**Input:** Confirmed user stories from step 1b
**Output:** `docs/data-model.md` — complete schema design (no migrations yet, just design)
**Gate:** User reviews and confirms the data model before any code is written
**State update:** `{ "current_step": "scaffold", "completed": ["prd", "data-model"] }`

Design the full data model upfront before scaffolding.
Getting the schema right now avoids painful migrations later.
Document every table, column, type, and relationship.

---

### Step 3 — Scaffold
**Skill:** `.claude/skills/scaffold/SKILL.md`
**Input:** PRD + confirmed tech stack
**Output:**
  - Project repo initialised
  - Folder structure created
  - Dependencies installed
  - `.env.example` created
  - Git initialised with first commit
  - App runs locally (`npm run dev` or equivalent returns 200)
**Gate:** App boots without errors. Home page or health endpoint responds.
**State update:** `{ "current_step": "db-migrate", "completed": ["prd", "data-model", "scaffold"] }`

---

### Step 4 — DB migration
**Skill:** `.claude/skills/db/SKILL.md`
**Input:** Data model from step 2 + scaffolded project
**Output:**
  - ORM schema file written (Prisma, Drizzle, SQLAlchemy, etc.)
  - Initial migration created and run
  - Seed data created for local development
  - `docs/data-model.md` confirmed matches schema
**Gate:** Migration runs clean. `prisma studio` or equivalent shows correct tables.
**State update:** `{ "current_step": "build-core", "completed": ["prd", "data-model", "scaffold", "db-migrate"] }`

---

### Step 5 — Build core features
**Skills:** `.claude/skills/design/SKILL.md` + `.claude/skills/review/SKILL.md`
**Input:** PRD must-have features list
**Output:** All v1 must-have features implemented and committed
**Gate:** Each feature works end-to-end locally. No console errors.
**State update:** `{ "current_step": "test", "completed": [..., "build-core"] }`

Build features in dependency order:
1. Auth (if required) — everything else depends on this
2. Core data operations (create, read, update, delete)
3. UI flows for each must-have feature
4. Error states and loading states

Run `.claude/skills/review/SKILL.md` after each major feature, not just at the end.

---

### Step 6 — Test
**Skill:** `.claude/skills/test/SKILL.md`
**Input:** Full codebase
**Output:**
  - Unit tests for all utility functions
  - Integration tests for all API routes
  - At least one end-to-end test for the critical user path
**Gate:** `Failed: 0`. Coverage on critical paths.
**State update:** `{ "current_step": "deploy", "completed": [..., "test"] }`

If tests fail → run `.claude/skills/debug/SKILL.md`. Fix root cause. Re-run. Do not proceed.

---

### Step 7 — Deploy
**Skill:** `.claude/skills/deploy/SKILL.md`
**Input:** Passing test suite, clean git state
**Output:** App live on staging URL with working domain
**Gate:** All must-have features work on staging. No errors in logs.
**State update:** `{ "current_step": "done", "status": "complete" }`

Set up CI/CD at this step so future deploys are automatic:
- GitHub Actions or equivalent
- Auto-deploy on push to main
- Run tests before every deploy

---

## Failure handling

If any step fails after one retry:
1. Update state: `{ "status": "blocked", "blocked_at": "{step}", "reason": "{what failed}" }`
2. Report clearly to the user — do not try to silently work around it
3. Wait for user input

## State file location
`.claude/state.json` in the new project repo (create it at the start of step 1).

## Workflow complete
When `current_step` is `done`, deliver:
- Live staging URL
- Local dev setup instructions
- Summary of what was built vs the PRD
- Suggested first next features for v2
- Any technical debt or shortcuts noted during build
