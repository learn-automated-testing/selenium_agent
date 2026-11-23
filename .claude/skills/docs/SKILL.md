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
name: docs
description: Writes and updates the project's documentation — README, API reference, architecture decision records (ADRs), changelog, user guides, runbooks. Keeps docs honest (they match the code) and useful (they answer the reader's actual question). Use when the user says "write the docs", "update the README", "write an ADR", "write release notes", "document this", "write a changelog entry", or after any change that alters public behaviour.
---

# Skill: docs

## Purpose
Produce and maintain documentation that stays true to the code and serves the reader — not documentation for its own sake.

## When to trigger this skill
- Any change that alters **public behaviour** — exported API, CLI flag, config key, HTTP response, UI copy
- New feature shipped → changelog entry + user-facing docs if surfaced
- Architectural decision made → ADR
- Bug fix with user-visible consequences → release notes entry
- User says "write the docs", "document this", "update the README", "write release notes", "write an ADR"
- Post-incident → runbook update
- Onboarding a new collaborator → README / getting-started pass

Do **not** invoke this skill for inline code comments — those are the developer's responsibility in code, not a docs task.

## The four docs rules

**1. Write for the reader you actually have, not the one you wish you had.**
Readers come with a question. Open with the answer, not the history. If the reader is a new user, start with "what this is, how to install, first-run command". If the reader is a future maintainer, start with "why this decision, what it rules out".

**2. Docs that lie are worse than no docs.**
- Every code example must be runnable as written
- Every CLI flag / config key / API endpoint must exist in the current version
- Every screenshot must match the current UI
- If you cannot verify a claim, do not make it

**3. One canonical location per fact.**
Duplicating a truth across README, docs site, and code comments guarantees at least one copy goes stale. Pick one home; link from everywhere else.

**4. Delete before you add.**
Dead docs are more dangerous than missing docs — they actively mislead. When updating, remove anything that is no longer true before writing anything new.

## Document types

### README (project entry point)
Structure the first screen:
```
# {Project name}
{One-line description: what it is, for whom}

## Install
{The exact commands, copy-pasteable}

## Quick start
{30-second example showing the core value}

## Documentation
{Links to deeper docs}
```
Keep the README under 200 lines. Push detail into `docs/`.

### API reference
- Auto-generate where the language allows (TSDoc → TypeDoc, Rustdoc, godoc, Sphinx)
- Manual handwritten pages become stale — use them only for narrative overviews
- Every public export gets: name, signature, what it does, parameter descriptions, return, one example, exceptions/errors

### Architecture Decision Record (ADR)
One file per decision under `docs/adr/NNNN-{slug}.md`:
```markdown
# NNNN. {Decision title}

- Status: {proposed | accepted | superseded by NNNN}
- Date: {YYYY-MM-DD}

## Context
{What forces are at play? What constraints?}

## Decision
{What we are doing — one sentence up front}

## Consequences
{What becomes easier, harder, impossible}

## Alternatives considered
{What else we looked at and why we passed}
```
ADRs are append-only — supersede, do not edit. Number sequentially, never renumber.

### Changelog
Follow [Keep a Changelog](https://keepachangelog.com/) format. One entry per release under version headings:
```markdown
## [1.4.0] - 2026-04-23
### Added
- ...
### Changed
- ...
### Fixed
- ...
### Removed
- ...
### Security
- ...
```
Write for the user of the library, not the committer — "fixed memory leak when X" beats "refactor foo.ts".

### User guide
- Task-oriented, not feature-oriented — "how do I do X?" not "the X module"
- Start each page with: what you'll accomplish, prerequisites, 30-second summary
- One runnable example per concept
- Common pitfalls at the bottom, not buried inline

### Release notes (user-facing)
Shorter than the changelog, narrative. Answer: "what changed that affects me?" Group by user value, not code change.

### Runbook
Owned by devops — see `.claude/skills/deploy/SKILL.md` and `.claude/skills/iac/SKILL.md`. The docs skill contributes the structural template; devops fills the specifics.

## Workflow

1. **Identify the reader.** Who opens this doc, and what question do they have?
2. **Read what exists.** Docs you update must agree with the rest; docs you write must not duplicate an existing home.
3. **Verify every claim against the code.** Run the install command, execute the code sample, hit the endpoint, inspect the UI.
4. **Write the first sentence as the answer.** Not the setup, not the context — the answer.
5. **Cut ruthlessly.** If a sentence does not advance the reader's question, remove it.
6. **Cross-link.** Add pointers to and from adjacent docs (`See also: ...`).
7. **Verify again.** Build the docs site if one exists; check links resolve; re-run every example.

## Pre-publish checklist
- [ ] Every code example runs as written against the current version
- [ ] Every CLI flag / API / config key exists in the code being documented
- [ ] Screenshots match the current UI (or are absent if they'd go stale)
- [ ] No duplicated facts — each truth has one canonical home
- [ ] Spellcheck clean (no typos — they destroy trust)
- [ ] Links resolve (no 404s to internal pages)
- [ ] Dates and version numbers match the release

## Handoffs
- **Product owner** — invoke this skill for changelogs, release notes, product announcements
- **Developer** — invoke this skill when changing a public API, flag, or config key; update README + API reference as part of the commit
- **Devops** — invoke this skill for runbook updates after deploy/infra changes or incidents
- **Business analyst** — invoke this skill for ADRs, architecture overviews, and process docs
- **Technical-writer agent** — escalate when the task is a coherent docs pass across many files (new-app finalisation, big refactor, docs drift cleanup) rather than a single targeted update

## What you never do
- Never document behaviour that does not exist yet ("planned", "coming soon") in the main README — put it in an ADR or roadmap doc instead
- Never copy-paste a code example you have not run
- Never leave a TODO or placeholder in published docs — if it's not ready, don't publish that section
- Never ship docs that contradict other docs — fix the contradiction before landing
- Never write comments about the current PR or recent changes into the code ("added for issue #123") — those belong in commit messages / PR descriptions
