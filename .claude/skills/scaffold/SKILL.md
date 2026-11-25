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
name: scaffold
description: Bootstraps a new app or feature with a clean, production-ready starting structure — stack setup, folder layout, env config, git init. Use when the user says "start a new app", "scaffold this", "create a new project", "bootstrap", or beginning a new feature module.
---

# Skill: scaffold

## Purpose
Bootstrap a new application or feature from scratch with a clean, production-ready starting structure.

## When to trigger this skill
- User says "start a new app", "scaffold this", "create a new project", "bootstrap"
- Beginning a new feature that needs its own module structure
- Setting up a new microservice or API route group

## Prerequisites
- Know the app type: web app, API, CLI tool, mobile, etc.
- Know the tech stack, or ask before assuming
- Know the target deployment platform (Vercel, Railway, Fly.io, etc.)
- Have git initialised, or initialise it as part of this skill

## Steps

1. **Confirm the stack before touching anything**
   Ask if not told:
   - Frontend framework? (React, Vue, Svelte, plain HTML)
   - Backend? (Node/Express, Python/FastAPI, Go, none)
   - Database? (Postgres, SQLite, MongoDB, none)
   - Styling? (Tailwind, CSS modules, styled-components)
   - Auth? (Clerk, Auth.js, Supabase, roll-your-own)

2. **Initialise the project**

   **Next.js (most common web app):**
   ```bash
   npx create-next-app@latest my-app \
     --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
   cd my-app
   ```

   **FastAPI (Python API):**
   ```bash
   mkdir my-api && cd my-api
   python -m venv venv && source venv/bin/activate
   pip install fastapi uvicorn python-dotenv
   ```

   **Express (Node API):**
   ```bash
   mkdir my-api && cd my-api
   npm init -y
   npm install express dotenv cors helmet
   npm install -D typescript ts-node @types/node @types/express nodemon
   ```

3. **Create the standard folder structure**
   ```
   src/
   ├── components/     # UI components
   ├── pages/ or app/  # Routes
   ├── lib/            # Shared utilities
   ├── hooks/          # Custom React hooks
   ├── types/          # TypeScript interfaces
   ├── styles/         # Global styles
   └── tests/          # Test files mirror src/
   ```

4. **Set up environment config**
   ```bash
   touch .env.local .env.example
   echo ".env.local" >> .gitignore
   ```
   Add placeholders to `.env.example` — never real values.

5. **Initialise git**
   ```bash
   git init
   git add .
   git commit -m "chore: initial scaffold"
   ```

6. **Set up linting and formatting**
   ```bash
   # ESLint + Prettier (JS/TS)
   npm install -D prettier eslint-config-prettier
   echo '{"semi":false,"singleQuote":true,"tabWidth":2}' > .prettierrc
   ```

7. **Add a basic health check or home page**
   - API: `GET /health` returns `{ status: "ok", timestamp: ... }`
   - Web: home page renders without errors

8. **Verify it runs**
   ```bash
   npm run dev   # or uvicorn main:app --reload
   ```

## Rules and constraints
- Never scaffold without confirming the stack first
- Always create `.env.example` — never commit real secrets
- Always initialise git before writing code
- Keep the initial scaffold minimal — do not add features, just structure
- The scaffold should run and render something on the first `npm run dev`

## Output format
```
Scaffold complete
─────────────────
App:    my-app (Next.js 14, TypeScript, Tailwind)
Runs:   http://localhost:3000
Git:    initialised, first commit made

Structure created:
  src/components/
  src/app/
  src/lib/
  src/types/
  .env.example

Next step: add your first feature, or run the prd skill to spec it out first.
```
