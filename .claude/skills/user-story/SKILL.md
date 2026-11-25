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
name: user-story
description: Decomposes a confirmed epic into individual user stories using the story template. Each story is one buildable unit with explicit acceptance criteria. Use when the user says "write the stories for this epic", "break the epic into stories", "draft acceptance criteria", or after an epic is confirmed.
---

# Skill: user-story

## Purpose
Turn a confirmed epic into a set of **user stories** — each one a buildable unit with explicit acceptance criteria, priority, and testing plan. Stories are what the developer agent actually picks up.

## When to trigger this skill
- After an epic is confirmed and the testing scope has been decided
- When the user says "write the stories", "break the epic into stories", "draft ACs"
- Before handing work to the developer agent — the developer needs stories, not epics

## Prerequisites
- A confirmed epic at `docs/requirements/PRD-NNN-<slug>/EPIC-NNN-<slug>/EPIC-NNN-<slug>.md`
- The story template at `.claude/templates/requirements/US-TEMPLATE.md`
- The epic's testing scope must already be decided (per `.claude/rules/story-testing.md` if present)
- Knowledge of which test frameworks are in use for this project (filled into the story template)

## Steps

1. **Read the epic and template**
   - Read the target epic file
   - Read `.claude/templates/requirements/US-TEMPLATE.md`
   - List existing stories in the epic folder to pick the next `US-NNN` (zero-padded, three digits, unique within the epic)

2. **List the stories before drafting any**
   Working from the epic's scope (in scope) and users sections:
   - Propose the full set of stories as a flat list with one-line descriptions and priorities (must / should / could / wont-now)
   - Confirm the list with the user **before** writing the story files
   - Stories should each describe one observable behavior change — if a story needs an "and" in its title, it is probably two stories

3. **Fill the template per story**
   For each confirmed story:
   - Copy `.claude/templates/requirements/US-TEMPLATE.md` to `docs/requirements/PRD-NNN-<slug>/EPIC-NNN-<slug>/US-NNN-<slug>.md`
   - Set frontmatter: `id`, `epic`, `priority`, `status: draft`, `testing` (list of planned levels, or `[]` if out of scope)
   - Write the story sentence: *As a <role>, I want to <action>, so that <value>*
   - Fill **Context**: existing implementation, what this story builds on, links to adjacent files / stories
   - Write **Acceptance criteria** as observable behaviour — one behaviour per line, testable, no implementation detail
   - Fill **Testing** section with the project's actual test frameworks (read from `.claude/context.md` or ask the user). Replace the `<unit-framework>` / `<integration-framework>` / `<e2e-framework>` placeholders with the chosen tools.
   - Add **Notes / implementation hints** only if there is non-obvious technical guidance worth recording
   - List any **Open questions** that block the story

4. **Update the epic file**
   Add links to the new story files under the epic's **User stories** section, grouped by priority. Update the **Milestones** table if the milestone groupings are now clear.

5. **Review with the user**
   - Read back the story list and the ACs of any story whose behaviour is non-obvious
   - Ask: "Are these the right behaviours? Any AC missing or wrong?"
   - Resolve open questions that would block the developer agent

6. **Mark stories ready**
   Stories that pass review move from `status: draft` to `status: ready`. Only `ready` stories should be picked up by the developer agent.

## Rules and constraints
- One observable behaviour per AC line — no compound criteria
- ACs describe behaviour, not implementation. ("X is visible" not "we add a reducer")
- Never invent test framework names — read them from `.claude/context.md` or ask
- Never write a story that spans more than one epic — split it
- Never skip the testing question — frontmatter `testing` must be set explicitly (a non-empty list, or `[]` with reason in the epic)

## Output format
One file per story at `docs/requirements/PRD-NNN-<slug>/EPIC-NNN-<slug>/US-NNN-<slug>.md`, with frontmatter, story sentence, context, acceptance criteria, testing plan, and any notes. The epic file is updated to link them.
