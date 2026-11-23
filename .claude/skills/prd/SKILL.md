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
name: prd
description: Turns a rough idea into a clear Product Requirements Document — the highest level of the spec hierarchy (PRD > epic > user story). Captures problem, goal, users, success metrics, and high-level capabilities. Use when the user says "write a PRD", "spec this out", "I have an idea", or before any new feature. Does not produce detailed user stories — those live in the `epic` and `user-story` skills.
---

# Skill: prd

## Purpose
Turn a rough idea into a clear Product Requirements Document (PRD) — the **top of the spec hierarchy**. The PRD answers *should we build it and what does success look like*. Decomposing the work into buildable slices and individual stories happens in the `epic` and `user-story` skills.

## Spec hierarchy

```
PRD              (this skill)        — vision, problem, goal, success metrics
  └── Epic       (epic skill)        — coherent slice of work, scope, milestones
        └── User story  (user-story skill)  — one buildable unit + acceptance criteria
```

Do not write detailed user stories or acceptance criteria here — those belong in the `user-story` skill. This skill captures **capabilities** at most (one-line outcomes), not stories.

## When to trigger this skill
- User says "write a PRD", "spec this out", "I have an idea", "help me plan this feature"
- Before starting any new feature or app
- When an idea is vague and needs structure before handing it to the `epic` skill

## Prerequisites
- A rough idea — even a single sentence is enough to start
- The PRD template at `.claude/templates/requirements/PRD-TEMPLATE.md`
- Optional: user research, competitor examples, existing designs

## Steps

1. **Extract the idea through questions**
   Ask only what's missing — do not ask for everything upfront:
   - What problem does this solve? Who has this problem?
   - What does success look like? How will we know it worked?
   - What is explicitly out of scope for this version?
   - Any technical constraints? (existing stack, integrations, deadlines)

2. **Pick the PRD number and slug**
   - List existing PRDs at `docs/requirements/PRD-*/PRD-*.md` to pick the next `NNN` (zero-padded, three digits)
   - Choose a kebab-case `<slug>` — short, descriptive (e.g. `password-reset`)

3. **Fill the template**
   - Copy `.claude/templates/requirements/PRD-TEMPLATE.md` to `docs/requirements/PRD-NNN-<slug>/PRD-NNN-<slug>.md`
   - Fill: status, owner, source material, problem statement, goal, users, capabilities (one line each — no ACs), NFRs, out of scope, open questions, success metrics
   - Leave the **Epics** section empty — it gets populated by the `epic` skill
   - Remove the template instruction block at the top once filled

4. **Review with the user**
   - Read back the goal and the capability list
   - Ask: "Does this match what you had in mind?"
   - Resolve any open questions that block decomposition into epics

5. **Commit the PRD**
   - `git commit -m "docs: add PRD-NNN <slug>"`

6. **Hand off to the `epic` skill**
   Once the PRD is confirmed, invoke `.claude/skills/epic/SKILL.md` to break the capabilities into epics. Do not skip this step — going straight from PRD to code skips the slice-of-work decision.

## Rules and constraints
- Never start writing code during this skill — spec first, build second
- Never write detailed acceptance criteria here — those belong to user stories
- Capabilities are one-liners, not stories. If you find yourself writing "As a … I want …" with ACs, stop and move that work into the `user-story` skill.
- Keep language plain — no jargon unless the user uses it
- If the user cannot define success metrics, help them find one before finishing

## Output format
A filled markdown PRD at `docs/requirements/PRD-NNN-<slug>/PRD-NNN-<slug>.md`, ready to commit and ready to hand to the `epic` skill.
