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
name: hotfix
description: Emergency production-fix workflow — for production-down, data-loss, or active security incidents only. Fastest-safe path direct to production. Use when the user says "hotfix", "prod is down", "critical production issue", or "security breach".
---

# Workflow: hotfix

## Purpose
Fix a critical production issue as fast as possible, with minimum risk.
Use only for production-down or data-loss situations.

## Before you start
This is an emergency workflow. Speed matters but correctness matters more.
Do not skip gates. A bad hotfix makes things worse.

---

## Sequence

### Step 1 — Assess
**No skill — direct assessment**
**Input:** Description of what is broken in production
**Output:** Clear statement of: what is broken, who is affected, severity
**Gate:** Severity confirmed as critical (production down, data loss, security breach)

If not critical → use `.claude/skills/bug-fix/SKILL.md` instead.

---

### Step 2 — Reproduce and diagnose
**Skill:** `.claude/skills/debug/SKILL.md`
**Input:** Production error logs + reproduction steps
**Output:** Root cause identified
**Gate:** Root cause confirmed before touching code
**State update:** `{ "current_step": "fix", "severity": "critical", "root_cause": "{cause}" }`

Pull production logs first:
```bash
vercel logs --prod
railway logs
fly logs
```

---

### Step 3 — Fix
**Skill:** `.claude/skills/debug/SKILL.md`
**Input:** Root cause
**Output:** Minimal fix committed to a hotfix branch
**Gate:** Fix is as small as possible. Only touches the broken thing.
**State update:** `{ "current_step": "test", "completed": ["assess", "diagnose", "fix"] }`

Smallest possible change. This is not the time to refactor.
Create branch: `git checkout -b hotfix/{issue-name}`

---

### Step 4 — Test (fast)
**Skill:** `.claude/skills/test/SKILL.md`
**Input:** Fix + test suite
**Output:** Existing tests passing. Quick smoke test of the fixed path.
**Gate:** No new failures. Fixed path works.
**State update:** `{ "current_step": "deploy", "completed": [..., "test"] }`

Run the full suite. Do not skip. A broken test suite means the fix isn't safe.

---

### Step 5 — Deploy direct to production
**Skill:** `.claude/skills/deploy/SKILL.md`
**Input:** Passing tests on hotfix branch
**Output:** Fix live in production
**Gate:** Production health check passes. Issue confirmed resolved.
**State update:** `{ "current_step": "follow-up", "completed": [..., "deploy"] }`

Hotfixes go direct to production — no staging review — because staging delay costs users.
Merge hotfix branch back to main immediately after.

---

### Step 6 — Follow-up (do not skip)
**No skill — manual step**
After the fire is out:
1. Write a regression test (via `.claude/skills/test/SKILL.md`) if not already done
2. Document what happened in `docs/incidents/{date}-{issue}.md`
3. Identify root cause and whether it can happen again
4. Schedule a proper fix if the hotfix was a patch, not a real fix

**State update:** `{ "current_step": "done", "status": "complete" }`

---

## State file location
`.claude/state.json` in the project repo.
