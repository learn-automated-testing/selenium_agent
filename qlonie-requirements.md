# Qlonie Configuration Requirements — selenium_agent

## Project Identity

| Field | Value |
|-------|-------|
| **Project** | selenium_agent |
| **Type** | Node.js MCP (Model Context Protocol) server |
| **Purpose** | AI-driven browser automation — 60+ tools for test generation, healing, planning, and analysis |
| **UI Framework** | None (no React, no Vue, no frontend) |
| **Runtime** | Node.js 18+ |
| **Language** | TypeScript (strict mode, ESM, NodeNext module resolution) |
| **Build** | `tsc` only — no bundler, no webpack, no vite |

## Architecture

| Field | Value |
|-------|-------|
| **Pattern** | Feature-Sliced |
| **State Management** | Context class (single `Context` instance manages browser session, snapshots, element refs) |
| **Side Effects** | Service Layer (`Context` class mediates all browser and filesystem operations) |

### Actual Folder Structure

```
selenium-mcp-server/src/
├── index.ts                    # Bootstrap
├── server.ts                   # MCP protocol entry point
├── context.ts                  # Browser session state (the service layer)
├── types.ts                    # Shared type definitions
├── utils/                      # Shared helpers (paths, schema, element-discovery, logger)
├── grid/                       # Selenium Grid integration (GridClient, GridSession, SessionPool)
└── tools/                      # 60+ tools grouped by capability domain
    ├── base.ts                 # Abstract BaseTool class
    ├── index.ts                # Tool registry (getAllTools)
    ├── navigation/             # navigate, back, forward, refresh
    ├── elements/               # click, hover, drag, select
    ├── input/                  # type, keys, file upload
    ├── mouse/                  # click, move, drag
    ├── page/                   # snapshot, screenshot
    ├── browser/                # JS exec, console, dialog, network, pdf, resize, wait
    ├── tabs/                   # list, new, close, select
    ├── verification/           # element, text, value, list
    ├── recording/              # start, stop, status, clear
    ├── session/                # close, reset
    ├── batch/                  # batch-execute
    ├── agents/                 # generator, healer, planner (high-level workflows)
    ├── analyzer/               # setup, scan, risk-profile, documentation
    └── grid/                   # grid sessions, parallel explore/execute
```

**Note:** There are NO `components/`, `hooks/`, `lib/`, or `pages/` directories. This is not a UI project.

## Code Standards

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Files | `kebab-case` | `batch-execute.ts`, `element-discovery.ts` |
| Classes | `PascalCase` | `GeneratorSetupTool`, `GridSession` |
| Functions | `camelCase` | `resolveOutputDir`, `discoverNavigationLinks` |
| Variables | `camelCase` | `testsDir`, `frameworkStr` |
| Constants | `SCREAMING_SNAKE` | (not heavily used) |

**Note:** No "Components" naming — this project uses classes, not UI components.

### File Size

| Setting | Value |
|---------|-------|
| **Row Ceiling** | Modular (300 lines max) |
| **Split threshold** | 240 lines (80%) |
| **Actual median** | 38 lines |
| **Actual average** | 81 lines |
| **Pattern** | One tool class per file |

### Error Handling: Result Types

Every tool returns `ToolResult` via `this.success()` or `this.error()`. No exceptions propagate. `try-catch` is used only to capture external failures (filesystem, selenium) and convert them into result types.

### Comment Style: Silent

No comments unless logic is non-obvious. No JSDoc. No AI headers. Code is self-documenting through descriptive naming.

### Core Code Rules

1. **All tools extend BaseTool** — one tool class per file
2. **Named exports only** — zero default exports in the entire codebase
3. **Barrel exports** — every tool directory has an `index.ts`
4. **Strict TypeScript — no `any`** (3 minor exceptions for selenium driver typing gaps)
5. **Result types for errors** — `this.success()` / `this.error()`, never throw
6. **ESM conventions** — `.js` extensions in all imports, `import type` for type-only imports

## Linting & Formatting

| Tool | Status |
|------|--------|
| **ESLint** | Off (not installed) |
| **Prettier** | Off (not installed) |
| **Biome** | Off (not installed) |
| **TypeScript** | On — `tsc --strict` is the only code quality tool |

## Testing

| Setting | Value |
|---------|-------|
| **Testing frameworks** | None configured |
| **Mocking** | N/A |
| **Test location** | N/A |
| **Test suffix** | N/A |

This project **generates** tests for other projects in any framework (pytest, playwright, robot, jest, mocha, java, etc.). The framework, output directory, and file naming are chosen at runtime by the user. Testing configuration belongs to consumer projects, not here.

## Dependencies

**Runtime:**
- `@modelcontextprotocol/sdk` — MCP protocol
- `selenium-webdriver` — browser automation
- `zod` — schema validation
- `yaml` — YAML serialization

**Dev:**
- `typescript` — build
- `@types/node`, `@types/selenium-webdriver` — type definitions

No UI libraries. No test libraries. No linters. No bundlers.
