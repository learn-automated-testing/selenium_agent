# Selenium MCP Server

Node.js MCP (Model Context Protocol) server for AI-driven browser automation.
TypeScript, ESM, strict mode. No UI framework.

## Project Standards

Read `.qlonie/skills/` before making changes:
- `.qlonie/skills/index.md` — project overview
- `.qlonie/skills/architecture.md` — Feature-Sliced Design
- `.qlonie/skills/custom.md` — TypeScript coding guidelines

## Test Skills

Read `.qlonie/skills/tests/` for test specifications:
- `.qlonie/skills/tests/index.md` — test index (stories, risk, priorities)
- `.qlonie/skills/tests/main-server-initialization/` — server init test stories

Also read `.claude/skills/qlonie-skills.md` for a summary.

## Key Structure

- `selenium-mcp-server/src/` — all source code
- `src/context.ts` — browser session state (Context class)
- `src/tools/base.ts` — BaseTool abstract class, all tools extend it
- `src/tools/` — 60+ tools grouped by domain (navigation, elements, grid, agents, etc.)
- `src/grid/` — Selenium Grid integration
- `src/utils/` — shared helpers (paths, schema, element-discovery)

## Build

```bash
cd selenium-mcp-server && npm run build
```
