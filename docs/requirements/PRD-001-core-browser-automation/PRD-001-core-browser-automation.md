# PRD-001 — Core MCP Browser Automation

> **Status:** done (2026-05-13)
> **Owner:** dev-team
> **Reviewers:** —
> **Source material:** `README.md`, `docs/MCP_CLIENT_SETUP.md`, `qlonie-requirements.md`

## Problem statement

AI agents (LLMs running in MCP clients like Claude Desktop, Cursor, Windsurf) have no way to interact with web browsers. They cannot navigate pages, click elements, fill forms, take screenshots, or verify page state. This prevents AI from helping with browser-based tasks such as testing, data extraction, form filling, and workflow automation. Existing browser-automation libraries require programmatic integration that LLMs cannot use directly.

## Goal

An AI agent can control a web browser through MCP tools — navigating pages, interacting with elements, verifying state, and managing sessions — enabling full browser automation without human intervention.

## Users

- **AI Agents (LLMs)** — execute browser automation through MCP tool calls in natural language conversations.
- **Developers** — configure, extend, and self-host the MCP server; integrate it into dev workflows.
- **QA Engineers** — use AI agents to automate browser testing, capture page state, and verify behavior.

## Capabilities (high level)

- Navigation & Page Analysis — navigate to URLs, traverse browser history, refresh pages, capture structured page snapshots, take full-page screenshots
- Element Interaction — click, hover, select options, and drag & drop elements using ref-based addressing from page snapshots
- Input & Mouse Control — type text into fields, press keyboard keys, upload files, precise mouse movements/clicks/drags at coordinates
- Tab Management — list, create, select, and close browser tabs
- Verification & Waits — verify element visibility, text presence, input values, and element lists; wait for dynamic conditions
- Browser Utilities — execute JavaScript, handle dialogs, monitor console/network, resize viewport, generate PDFs
- Session Management — close browser, reset session, enable stealth mode for anti-detection

## Non-functional requirements

- **Performance:** Tool execution < 5 s p95; page snapshot < 2 s
- **Security:** Path sandboxing for file operations (`src/utils/sandbox.ts`); no arbitrary code execution outside browser context
- **Compatibility:** Chrome/Chromium primary; Firefox supported via Selenium Grid
- **Reliability:** Graceful error handling via Result types — no exceptions propagate from tool execution
- **Transport:** stdio (standard MCP) and HTTP (Lambda) transports

## Out of scope

- Visual regression / pixel-diff comparison
- Built-in test runner (tests are generated, not executed by core tools)
- Multi-browser orchestration (covered by PRD-003 Selenium Grid)
- Authentication / authorization for remote access (covered by PRD-004)

## Open questions

- None — all capabilities are implemented.

## Success metrics

- 70+ MCP tools available and functional
- AI agents can complete end-to-end browser workflows (navigate, interact, verify) without human intervention
- Published on npm as `selenium-ai-agent` with 6 MCP client integrations documented

---

## Epics

- [EPIC-001 — Navigation & Page Analysis](./EPIC-001-navigation-and-pages/EPIC-001-navigation-and-pages.md)
- [EPIC-002 — Element & Input Interaction](./EPIC-002-element-interaction/EPIC-002-element-interaction.md)
- [EPIC-003 — Verification & Waits](./EPIC-003-verification-and-waits/EPIC-003-verification-and-waits.md)
- [EPIC-004 — Browser Utilities](./EPIC-004-browser-utilities/EPIC-004-browser-utilities.md)
- [EPIC-005 — Session Management](./EPIC-005-session-management/EPIC-005-session-management.md)
