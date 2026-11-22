# PRD-004 — Serverless Deployment & Authentication

> **Status:** done (2026-05-13)
> **Owner:** dev-team
> **Reviewers:** —
> **Source material:** `lambda/handler.js`, `lambda/Dockerfile`

## Problem statement

Running the MCP server locally limits accessibility. Teams need remote access to browser automation from cloud-based AI agents, CI/CD pipelines, and multi-user environments. Local deployment doesn't scale, lacks authentication, and cannot serve distributed teams. There is no standard way to expose an MCP server over HTTP with proper security.

## Goal

An AI agent can access the MCP server remotely via HTTP on AWS Lambda with OAuth 2.1 authentication — enabling secure, scalable, serverless browser automation accessible from anywhere.

## Users

- **AI Agents (LLMs)** — access MCP server remotely via HTTP with OAuth tokens or API keys.
- **DevOps/SRE** — deploy and manage Lambda infrastructure, configure S3 buckets and auth settings.
- **Developers** — configure authentication, manage API keys, integrate remote MCP into workflows.

## Capabilities (high level)

- Lambda MCP Transport — HTTP-based MCP protocol handler on AWS Lambda with stateless cold-start support and health checks
- OAuth 2.1 Authentication — Authorization Code flow with PKCE (RFC 7636), dynamic client registration (RFC 7591), self-validating HMAC tokens
- S3 Asset Storage — auto-upload screenshots to S3, return S3 URLs in tool responses

## Non-functional requirements

- **Performance:** Lambda cold start < 10 s (headless Chromium initialization); warm invocation < 5 s
- **Security:** OAuth 2.1 with PKCE; HMAC-SHA256 self-validating tokens; static API_KEY fallback; 8-hour token TTL; 5-minute auth code expiry
- **Scalability:** Stateless Lambda — scales horizontally with no shared state
- **Storage:** S3 for screenshots; configurable bucket via `SCREENSHOT_S3_BUCKET` env var

## Out of scope

- Multi-region deployment
- Custom domain / API Gateway configuration
- User management / admin UI
- Session persistence across Lambda invocations

## Open questions

- None — all capabilities are implemented.

## Success metrics

- Lambda endpoint accepts MCP JSON requests and returns tool results over HTTP
- OAuth 2.1 PKCE flow completes end-to-end (register → authorize → token → MCP)
- Screenshots auto-uploaded to S3 with URLs returned in responses
- Health check endpoint returns server status

---

## Epics

- [EPIC-013 — Lambda MCP Transport](./EPIC-013-lambda-mcp-transport/EPIC-013-lambda-mcp-transport.md)
- [EPIC-014 — OAuth 2.1 Authentication](./EPIC-014-oauth-authentication/EPIC-014-oauth-authentication.md)
- [EPIC-015 — S3 Asset Storage](./EPIC-015-s3-asset-storage/EPIC-015-s3-asset-storage.md)
