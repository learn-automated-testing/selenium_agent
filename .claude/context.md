# Project context: selenium-ai-agent

This file is read by every agent and skill before they act. It is the single source of
truth for project-specific stack, conventions, and domain knowledge. Keep it current.

## Stack

- **Primary language:** typescript
- **Package managers:** (none detected)
- **Frameworks:** (none detected)
- **Test frameworks:** mocha
- **CI/CD:** (none detected)
- **Deploy targets:** docker, docker-compose
- **IaC tools:** (none detected)
- **Has frontend:** false

## Documentation locations

- **README:** README.md
- **Contributing guide:** CONTRIBUTING.md
- **Docs directory:** docs
- **PRDs:** `docs/requirements/PRD-*/PRD-*.md`
- **Runbook:** `docs/runbook.md`
- **Data model:** `docs/data-model.md`
- **Design system:** `docs/design-system.md`

## Conventions

Fill in the project's conventions here. Examples:

- **Code style:** (e.g. "Google TypeScript Style Guide — see https://google.github.io/styleguide/tsguide.html")
- **Commit message format:** (e.g. "Conventional Commits — feat/fix/chore/docs/refactor")
- **Branch naming:** (e.g. "feature/*, bugfix/*, hotfix/*")
- **PR size guideline:** (e.g. "under 400 lines changed")
- **Review priorities:** (e.g. "correctness, security, performance, readability, style")

## Domain

- **Primary users:** Developers, QA Engineers, and DevOps/SRE teams
- **Domain:** AI-driven browser automation — MCP server enabling AI agents to control browsers via Selenium
- **Style guide:** (not specified)

Fill in the rest as the project crystallises:

- **Core entities:** The main data models (e.g. "users, orders, invoices")
- **Key workflows:** The main business processes (e.g. "order fulfilment, billing cycle")
- **Status vocabularies:** Domain-specific status transitions
- **Regulatory / compliance:** Any requirements that shape the product

## Guardrails

Project-specific things the agents must never do, or must always do. Examples:

- Never commit secrets, `.env` files, or API keys
- All async functions must have error handling
- All external API calls wrapped in try/catch with meaningful error messages
- Money stored as integer cents, never floats
- Timestamps always in UTC

## Notes

Free-form notes about the project — recent decisions, known tech debt, open questions.
