# Deployment Guide - PyPI and npm

This guide explains how to deploy the `ai-agent-selenium` package to both PyPI (Python) and npm (Node.js) using GitHub Actions.

---

## Prerequisites

### 1. GitHub Secrets Setup

You need to configure the following secrets in your GitHub repository:

**Settings → Secrets and variables → Actions → New repository secret**

#### Required Secrets:

1. **`PYPI_TOKEN`** - PyPI API token
   - Go to https://pypi.org/manage/account/token/
   - Create a new API token
   - Scope: "Entire account" or specific project
   - Copy the token (starts with `pypi-`)
   - Add to GitHub secrets

2. **`NPM_TOKEN`** - npm access token
   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Generate new token → "Automation" type
   - Copy the token
   - Add to GitHub secrets

3. **`TEST_PYPI_TOKEN`** (Optional) - For testing
   - Go to https://test.pypi.org/manage/account/token/
   - Create token for testing deployments
   - Add to GitHub secrets

### 2. Package Registration

**First-time setup**:

1. **Register on PyPI**:
   ```bash
   # Build the package
   python -m build

   # Upload to PyPI (first time)
   twine upload dist/*
   ```

2. **Register on npm**:
   ```bash
   cd npm-wrapper
   npm login
   npm publish --access public
   ```

After first manual publish, GitHub Actions can handle updates.

---

## Deployment Workflows

### Workflow 1: Automated Release (Recommended)

**File**: `.github/workflows/release.yml`

**Trigger**: Manual workflow dispatch

**What it does**:
1. ✅ Updates version in `pyproject.toml` and `package.json`
2. ✅ Commits version changes
3. ✅ Creates Git tag
4. ✅ Creates GitHub release
5. ✅ Publishes to PyPI
6. ✅ Publishes to npm

**How to use**:

1. Go to **Actions** tab in GitHub
2. Select **"Release and Deploy"** workflow
3. Click **"Run workflow"**
4. Fill in:
   - **Version**: e.g., `1.0.1`
   - **Release type**: `patch`, `minor`, or `major`
   - **Publish to PyPI**: ✅ (checked)
   - **Publish to npm**: ✅ (checked)
5. Click **"Run workflow"**

**Result**:
- ✅ Version updated everywhere
- ✅ Git tag created: `v1.0.1`
- ✅ GitHub release created
- ✅ Published to PyPI: `pip install ai-agent-selenium==1.0.1`
- ✅ Published to npm: `npm install ai-agent-selenium@1.0.1`

---

### Workflow 2: Publish Python Only

**File**: `.github/workflows/publish-python.yml`

**Trigger**:
- GitHub release published
- Manual workflow dispatch

**What it does**:
1. ✅ Builds Python package
2. ✅ Verifies agent files are included
3. ✅ Verifies documentation is included
4. ✅ Runs `twine check`
5. ✅ (Optional) Publishes to Test PyPI
6. ✅ Publishes to PyPI

**How to use**:

**Option A: Trigger on release**
1. Create a GitHub release
2. Workflow runs automatically

**Option B: Manual trigger**
1. Go to **Actions** → **"Publish Python Package to PyPI"**
2. Click **"Run workflow"**
3. Click **"Run workflow"** button

---

### Workflow 3: Publish npm Only

**File**: `.github/workflows/publish-npm.yml`

**Trigger**:
- GitHub release published
- Manual workflow dispatch

**What it does**:
1. ✅ Verifies npm wrapper structure
2. ✅ Creates npm package
3. ✅ Verifies package contents
4. ✅ Publishes to npm

**Important**: Make sure PyPI package is published first, as the npm post-install script installs it!

**How to use**:

1. Go to **Actions** → **"Publish NPM Package"**
2. Click **"Run workflow"**
3. Click **"Run workflow"** button

---

### Workflow 4: Build and Test (CI)

**File**: `.github/workflows/build-test.yml`

**Trigger**:
- Push to `main` or `develop`
- Pull requests
- Manual dispatch

**What it does**:
1. ✅ Tests Python package build (Ubuntu, macOS, Windows)
2. ✅ Tests with Python 3.10, 3.11, 3.12
3. ✅ Verifies agent files are included
4. ✅ Verifies documentation is included
5. ✅ Tests installation
6. ✅ Tests npm wrapper (Ubuntu, macOS, Windows)
7. ✅ Tests with Node.js 18, 20
8. ✅ Runs integration tests

**Runs automatically** on every push and PR.

---

## Manual Deployment (Alternative)

### Deploy to PyPI Manually

```bash
# 1. Update version in pyproject.toml
# version = "1.0.1"

# 2. Build the package
python -m pip install --upgrade build twine
python -m build

# 3. Verify the build
twine check dist/*

# 4. Check package contents
tar -tzf dist/*.tar.gz | grep -E "(agents|AGENT_WORKFLOW|FRAMEWORK_STANDARDS)"

# 5. Upload to Test PyPI (optional)
twine upload --repository testpypi dist/*

# 6. Upload to PyPI
twine upload dist/*
```

### Deploy to npm Manually

```bash
# 1. Update version in npm-wrapper/package.json
cd npm-wrapper
npm version 1.0.1

# 2. Test the package
npm pack
tar -tzf *.tgz

# 3. Publish to npm
npm publish --access public
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (`build-test.yml`)
- [ ] Version number decided (semver)
- [ ] CHANGELOG updated (if you have one)
- [ ] Documentation reviewed
- [ ] Agent files verified:
  - [ ] `agents/selenium-test-planner.agent.md`
  - [ ] `agents/selenium-test-generator.agent.md`
  - [ ] `agents/selenium-test-healer.agent.md`
- [ ] Review gates verified in agent files
- [ ] Framework standards verified

### Deployment Steps

1. **Update Version Numbers**
   - [ ] `pyproject.toml` → `version = "X.Y.Z"`
   - [ ] `npm-wrapper/package.json` → `"version": "X.Y.Z"`

2. **Deploy to PyPI First**
   - [ ] Run Python publish workflow
   - [ ] Verify on https://pypi.org/project/ai-agent-selenium/
   - [ ] Test: `pip install ai-agent-selenium==X.Y.Z`

3. **Deploy to npm Second** (after PyPI)
   - [ ] Run npm publish workflow
   - [ ] Verify on https://www.npmjs.com/package/ai-agent-selenium
   - [ ] Test: `npm install ai-agent-selenium@X.Y.Z`

4. **Create GitHub Release**
   - [ ] Tag: `vX.Y.Z`
   - [ ] Release notes
   - [ ] Attach artifacts (optional)

### Post-Deployment

- [ ] Test PyPI installation: `pip install ai-agent-selenium`
- [ ] Test npm installation: `npm install ai-agent-selenium`
- [ ] Verify agents are accessible after install
- [ ] Verify review gates work
- [ ] Update documentation if needed
- [ ] Announce release (optional)

---

## Version Management

### Semantic Versioning

Follow [semver](https://semver.org/):

- **Major** (X.0.0): Breaking changes
  - Example: Changing agent file format
  - Example: Removing tools
  - Example: Changing workflow behavior

- **Minor** (0.X.0): New features (backward compatible)
  - Example: Adding new tools
  - Example: Adding new agent
  - Example: Enhancing existing features

- **Patch** (0.0.X): Bug fixes
  - Example: Fixing agent instructions
  - Example: Fixing documentation
  - Example: Bug fixes

### Current Version

Check current version:
```bash
# Python
python -c "import tomllib; print(tomllib.load(open('pyproject.toml', 'rb'))['project']['version'])"

# npm
cd npm-wrapper && node -p "require('./package.json').version"
```

### Sync Versions

**Important**: Keep both versions in sync!

```bash
# If you update one, update the other:
# pyproject.toml: version = "1.0.1"
# npm-wrapper/package.json: "version": "1.0.1"
```

The release workflow handles this automatically.

---

## Verification After Deployment

### Verify PyPI Package

```bash
# Install
pip install ai-agent-selenium

# Check version
pip show ai-agent-selenium

# Verify agents
python -c "
from pathlib import Path
import selenium_mcp
pkg_dir = Path(selenium_mcp.__file__).parent
agents = (pkg_dir.parent / 'agents').glob('*.agent.md')
print('Agent files:', list(agents))
"

# Verify command
selenium-mcp --help
```

### Verify npm Package

```bash
# Install
npm install ai-agent-selenium

# Check version
npm list ai-agent-selenium

# Verify post-install ran
# Should see: "✅ Selenium MCP Server installed successfully!"

# Verify command
npx ai-agent-selenium --help
```

### Verify Agent Content

```bash
# Check if review gates are present
python -c "
from pathlib import Path
import selenium_mcp

pkg_dir = Path(selenium_mcp.__file__).parent
planner = (pkg_dir.parent / 'agents' / 'selenium-test-planner.agent.md')
content = planner.read_text()

assert 'CRITICAL: Human Review Required' in content
assert 'STOP' in content
assert 'WAIT' in content
print('✅ Review gates verified!')
"
```

---

## Troubleshooting

### Agent Files Not Included

**Problem**: Agent files missing from package

**Solution**:
1. Check `MANIFEST.in`:
   ```
   recursive-include agents *.md
   ```

2. Check `pyproject.toml`:
   ```toml
   [tool.setuptools.package-data]
   "*" = ["agents/*.md"]
   ```

3. Rebuild and check:
   ```bash
   python -m build
   tar -tzf dist/*.tar.gz | grep agents/
   ```

### Documentation Not Included

**Problem**: `.md` files missing

**Solution**: Check `MANIFEST.in` includes:
```
include AGENT_WORKFLOW.md
include FRAMEWORK_STANDARDS.md
include INSTALLATION_GUIDE.md
# etc.
```

### npm Post-Install Fails

**Problem**: npm install fails because Python package not found

**Solution**:
1. Make sure PyPI package is published **first**
2. Check PyPI package name matches: `ai-agent-selenium`
3. Verify in `npm-wrapper/scripts/install-python-server.js`:
   ```javascript
   pip install ai-agent-selenium
   ```

### Version Mismatch

**Problem**: PyPI and npm have different versions

**Solution**: Use the unified release workflow or manually sync:
```bash
# Update both
# pyproject.toml: version = "1.0.1"
# npm-wrapper/package.json: "version": "1.0.1"
```

---

## GitHub Actions Secrets Reference

| Secret Name | Purpose | Where to Get |
|-------------|---------|--------------|
| `PYPI_TOKEN` | Publish to PyPI | https://pypi.org/manage/account/token/ |
| `NPM_TOKEN` | Publish to npm | https://www.npmjs.com/settings/tokens |
| `TEST_PYPI_TOKEN` | Test on Test PyPI | https://test.pypi.org/manage/account/token/ |
| `GITHUB_TOKEN` | Create releases | Auto-provided by GitHub |

---

## Deployment Flow Diagram

```
┌─────────────────────────────────────────────────┐
│  Manual Trigger: Release Workflow              │
│  Input: Version 1.0.1                           │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Update Versions                                │
│  - pyproject.toml: version = "1.0.1"            │
│  - package.json: "version": "1.0.1"             │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Commit & Tag                                   │
│  - git commit -m "chore: bump to 1.0.1"         │
│  - git tag v1.0.1                               │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Create GitHub Release                          │
│  Tag: v1.0.1                                    │
└──────────────────┬──────────────────────────────┘
                   │
      ┌────────────┴────────────┐
      ▼                         ▼
┌─────────────┐           ┌─────────────┐
│ PyPI Deploy │           │  npm Deploy │
│             │           │  (waits for │
│ 1. Build    │           │   PyPI)     │
│ 2. Verify   │           │             │
│ 3. Publish  │──────────▶│ 1. Build    │
│             │           │ 2. Verify   │
│ ✅ Done     │           │ 3. Publish  │
└─────────────┘           │ ✅ Done     │
                          └─────────────┘
                                │
                                ▼
                    ┌─────────────────────┐
                    │  Users Install      │
                    │                     │
                    │  pip install or     │
                    │  npm install        │
                    │                     │
                    │  ✅ Agents included │
                    │  ✅ Review gates    │
                    │  ✅ Standards       │
                    └─────────────────────┘
```

---

## Summary

### Recommended Deployment Process

1. **Use the Release Workflow** (`.github/workflows/release.yml`)
   - Handles everything automatically
   - Keeps versions in sync
   - Deploys to both PyPI and npm

2. **Required Secrets**:
   - `PYPI_TOKEN`
   - `NPM_TOKEN`

3. **Deployment Command**:
   - GitHub Actions → Release and Deploy → Run workflow
   - Input version → Run

4. **Result**:
   - ✅ Version updated
   - ✅ Git tagged
   - ✅ GitHub release created
   - ✅ PyPI published
   - ✅ npm published
   - ✅ Agent files included
   - ✅ Review gates working

### Manual Alternative

If you prefer manual control:
1. Deploy to PyPI first (`publish-python.yml`)
2. Deploy to npm second (`publish-npm.yml`)
3. Create GitHub release manually

Both approaches ensure agent files and review gates are included!
