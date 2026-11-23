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
name: epic
description: Decomposes a confirmed PRD (or rough idea) into one or more epic files using the epic template. Each epic is a coherent slice of work that groups related user stories. Use when the user says "break this PRD into epics", "scope an epic", "carve out work packages", or after a PRD is confirmed and before stories are written.
---

# Skill: epic

## Purpose
Turn a confirmed PRD (or a clearly framed idea) into one or more **epics** — coherent slices of work that each group related user stories. The PRD answers *should we build it*; the epic answers *what is the buildable slice*.

## When to trigger this skill
- After a PRD is confirmed and ready to be broken into work packages
- When the user says "break this into epics", "carve out the work", "create epics"
- Before any user stories are written — stories belong to an epic, not to a PRD directly

## Prerequisites
- A confirmed PRD at `docs/requirements/PRD-NNN-<slug>/PRD-NNN-<slug>.md`, **or** a rough idea framed enough to scope
- The epic template at `.claude/templates/requirements/EPIC-TEMPLATE.md`
- Knowledge of the project's testing rule: see `.claude/rules/story-testing.md` if it exists

## Steps

1. **Read the source material**
   - Read the relevant PRD (or capture the idea if no PRD exists)
   - Read the epic template at `.claude/templates/requirements/EPIC-TEMPLATE.md`
   - List existing epics under `docs/requirements/PRD-*/EPIC-*` to pick the next `NNN` (zero-padded, three digits)

2. **Decide how many epics**
   Ask the user — do not assume:
   - Is this one epic, or does it naturally split (e.g. by user role, by domain, by milestone)?
   - What would be the smallest valuable slice to ship first?
   Default to one epic unless there is a clear seam.

3. **Fill the template per epic**
   For each epic:
   - Copy `.claude/templates/requirements/EPIC-TEMPLATE.md` to `docs/requirements/PRD-NNN-<slug>/EPIC-NNN-<slug>/EPIC-NNN-<slug>.md`
   - Pick a kebab-case `<slug>` (short, descriptive)
   - Fill: status, owner, source document, problem statement, goal, scope (in/out), users, milestones, testing scope, decisions, open questions, success metrics
   - Leave the **User stories** section as empty placeholders — those get added by the `user-story` skill
   - Remove the template instruction block at the top once filled

4. **Resolve the testing scope question**
   Per `.claude/rules/story-testing.md` (if present), every epic must explicitly state whether testing is in scope and at what level. Do not skip this — it must be answered before stories are written.

5. **Review with the user**
   - Read back goal, scope, and testing decision per epic
   - Ask: "Does this carve up the work correctly?"
   - Resolve any open questions that block story decomposition

6. **Hand off to the `user-story` skill**
   Once epics are confirmed, invoke `.claude/skills/user-story/SKILL.md` to decompose each epic into stories.

## Rules and constraints
- Never write user stories inside an epic file — stories live in their own files (see `user-story` skill)
- Never skip the testing scope decision — it gates the acceptance-criteria phase
- One epic = one coherent slice. If you cannot describe the slice in one paragraph, split it.
- Out-of-scope items either become later epics or get logged to `docs/backlog.md`

## Output format
One folder per epic under `docs/requirements/PRD-NNN-<slug>/EPIC-NNN-<slug>/`, containing the filled `EPIC-NNN-<slug>.md`. Stories will be added in the same folder by the next skill.
