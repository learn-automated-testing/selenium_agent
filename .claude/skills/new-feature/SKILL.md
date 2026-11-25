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
name: new-feature
description: End-to-end new-feature workflow — UX design, PRD, DB migration, build, review, test, deploy — with gates between steps. Use when the user says "add a feature", "new feature", "build this feature", or starts a feature lifecycle in an existing app.
---

# Workflow: new feature

## Purpose
Take a feature idea from concept to deployed code, in a structured sequence with gates.
Use this workflow whenever adding a new feature to an existing app.

## Before you start
Read `.claude/state.json` in the project repo.
If a workflow is already in progress for this feature, resume from `current_step`.
If not, initialise state and start from step 1.

---

## Sequence

### Step 1 — UX Design
**Agent:** `.claude/agents/ux-designer.md`
**Input:** Feature idea from user + business process docs
**Output:** `docs/ux-{feature-name}.md` with user flows, screen specs, and wireframes
**Gate:** User has reviewed and confirmed the UX spec before proceeding
**State update:** `{ "current_step": "prd", "completed": ["ux"] }`

The UX designer maps user journeys, defines screen layouts, and specifies interactions
before any requirements are written. This ensures the PRD describes what users actually
need, not what the data model can do.

Skip this step if the feature has no UI (API-only, infra, backend logic). Note the skip:
`{ "skipped": ["ux"], ... }`

---

### Step 2 — PRD
**Skill:** `.claude/skills/prd/SKILL.md`
**Input:** UX spec from step 1 + feature idea from user
**Output:** `docs/requirements/PRD-{feature-name}/PRD-{feature-name}.md` — vision, capabilities (one-liners), success metrics. **No detailed user stories or ACs at this level.**
**Gate:** User has reviewed and confirmed the PRD's capabilities and success metrics
**State update:** `{ "current_step": "epic", "completed": ["ux", "prd"] }`

---

### Step 2a — Epic decomposition
**Skill:** `.claude/skills/epic/SKILL.md`
**Input:** Confirmed PRD from step 2
**Output:** One or more `docs/requirements/PRD-{feature-name}/EPIC-NNN-<slug>/EPIC-NNN-<slug>.md` — coherent slices of work, each with scope + testing-scope decision
**Gate:** User has confirmed the slice boundaries. Testing-scope answered for every epic before stories are written.
**State update:** `{ "current_step": "user-story", "completed": ["ux", "prd", "epic"] }`

---

### Step 2b — User stories
**Skill:** `.claude/skills/user-story/SKILL.md`
**Input:** Confirmed epic(s) from step 2a
**Output:** `docs/requirements/PRD-{feature-name}/EPIC-NNN-<slug>/US-NNN-<slug>.md` — one per buildable unit, with explicit acceptance criteria + chosen test frameworks
**Gate:** Every must-have story has `status: ready` and confirmed ACs. The developer agent does not pick up `draft` stories.
**State update:** `{ "current_step": "db", "completed": ["ux", "prd", "epic", "user-story"] }`

---

### Step 3 — DB migration
**Skill:** `.claude/skills/db/SKILL.md`
**Input:** Confirmed user stories from step 2b (ready stories drive schema needs)
**Output:**
  - Migration file created and run on local/dev
  - `docs/data-model.md` updated
**Gate:** Migration runs without errors. `docs/data-model.md` is up to date.
**State update:** `{ "current_step": "build", "completed": ["prd", "db"] }`

Skip this step if the feature requires no schema changes. Note the skip in state:
`{ "skipped": ["db"], ... }`

---

### Step 4 — Build
**Skills:** `.claude/skills/design/SKILL.md` + `.claude/skills/scaffold/SKILL.md` (if new files needed)
**Input:** UX spec + the next ready user story (`status: ready`) + updated data model
**Output:** Feature implemented — components, API routes, business logic committed
**Gate:** App runs locally without errors. No console errors or warnings.
**State update:** `{ "current_step": "review", "completed": ["ux", "prd", "db", "build"] }`

Build in this order:
1. Data layer (queries, mutations)
2. API layer (routes, controllers)
3. UI layer (components, pages)

---

### Step 5 — Review
**Skill:** `.claude/skills/review/SKILL.md`
**Input:** All code changed in this feature (diff from main)
**Output:** Review report saved to `.claude/review-{feature-name}.md`
**Gate:** Zero critical issues. Warnings resolved or explicitly accepted.
**State update:** `{ "current_step": "test", "completed": ["ux", "prd", "db", "build", "review"] }`

If critical issues found → return to Step 4 (build) to fix. Do not proceed.

---

### Step 6 — Test
**Skill:** `.claude/skills/test/SKILL.md`
**Input:** Feature code + existing test suite
**Output:** All tests passing. New tests written for this feature.
**Gate:** `Failed: 0`. No skipped tests.
**State update:** `{ "current_step": "deploy", "completed": ["ux", "prd", "db", "build", "review", "test"] }`

If tests fail → run `.claude/skills/debug/SKILL.md` to fix. Retry this step. Do not proceed to deploy with failures.

---

### Step 7 — Deploy
**Skill:** `.claude/skills/deploy/SKILL.md`
**Input:** Passing test suite, clean git state
**Output:** Feature live on staging URL
**Gate:** Health check passes. Feature works end-to-end on staging.
**State update:** `{ "current_step": "done", "status": "complete", "completed": ["ux", "prd", "db", "build", "review", "test", "deploy"] }`

Deploy to staging first. Only promote to production after user confirms staging looks good.

---

## Failure handling

If any step fails after one retry:
1. Update state: `{ "status": "blocked", "blocked_at": "{step}", "reason": "{what failed}" }`
2. Report clearly to the user what failed and why
3. Do not attempt to continue or work around the failure silently
4. Wait for user input before retrying

## State file location
`.claude/state.json` in the project repo.

## Workflow complete
When `current_step` is `done`, report:
- Feature name
- What was built (summary)
- Staging URL
- Any warnings or notes from review/test steps
- Suggested next step (promote to prod, or next feature)
