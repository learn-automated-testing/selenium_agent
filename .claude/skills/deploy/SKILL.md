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
name: deploy
description: Deploys apps safely to staging or production with pre-checks, release tagging, and post-deploy verification. Use when the user says "deploy", "ship it", "push to staging", "release", "go live", or needs a rollback.
---

# Skill: deploy

## Purpose
Deploy the application to staging or production safely, with checks before and after.

## When to trigger this skill
- User says "deploy", "ship it", "push to staging", "release", "go live"
- A feature has passed review and tests are green
- A hotfix needs to go out immediately

## Prerequisites
- All tests are passing (run test skill first)
- Git working tree is clean — no uncommitted changes
- Correct environment variables are set
- User has confirmed the target environment (staging vs production)

## Steps

1. **Confirm target environment**
   - Ask explicitly: "Deploy to staging or production?"
   - Never assume production. Default to staging.

2. **Pre-deploy checks**
   ```bash
   # Ensure clean git state
   git status
   git diff --stat

   # Run tests one final time
   npm test   # or pytest, go test, etc.

   # Check build works
   npm run build
   ```

3. **Tag the release**
   ```bash
   git tag -a v$(date +%Y%m%d-%H%M) -m "Deploy $(date)"
   git push origin --tags
   ```

4. **Deploy**

   **Vercel:**
   ```bash
   vercel --prod   # production
   vercel          # staging/preview
   ```

   **Railway:**
   ```bash
   railway up
   ```

   **Docker + VPS:**
   ```bash
   docker build -t app:latest .
   docker push registry/app:latest
   ssh user@server "docker pull registry/app:latest && docker-compose up -d"
   ```

   **Fly.io:**
   ```bash
   fly deploy
   ```

5. **Post-deploy verification**
   - Hit the health check endpoint: `curl https://yourapp.com/health`
   - Check logs for errors: `vercel logs` or `railway logs`
   - Smoke test the critical user path manually

6. **Report outcome**
   - URL of deployed app
   - Git commit SHA that was deployed
   - Any warnings from the deploy output

## Rules and constraints
- **Never deploy to production with failing tests**
- **Never deploy without a clean git state**
- Always deploy to staging first for new features
- Hotfixes may go direct to production but still require passing tests
- If deploy fails, do not attempt to fix it silently — report and stop

## Rollback procedure
```bash
# Vercel
vercel rollback

# Railway
railway rollback

# Docker
docker-compose down
docker run -d registry/app:previous-tag
```

## Output format
```
Deploy complete
───────────────
Environment: staging
URL:         https://my-app-git-main.vercel.app
Commit:      a3f9c12
Build time:  42s
Status:      healthy (200 OK on /health)

Next step: verify the feature works at the URL above, then promote to production.
```
