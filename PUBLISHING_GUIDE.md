# Complete Publishing Guide

This guide will help you publish both the Python package to PyPI and the npm wrapper to npm.

## Prerequisites

### For PyPI (Python Package)

1. **Create PyPI Account**
   - Production: https://pypi.org/account/register/
   - Test (recommended first): https://test.pypi.org/account/register/

2. **Install Publishing Tools**
   ```bash
   pip install build twine
   ```

3. **Create API Token**
   - Go to: https://pypi.org/manage/account/token/
   - Create token with scope: "Entire account"
   - Save the token (starts with `pypi-`)

### For npm (Node.js Package)

1. **Create npm Account**
   - Sign up: https://www.npmjs.com/signup

2. **Login to npm**
   ```bash
   npm login
   ```

## Part 1: Publishing Python Package to PyPI

### Step 1: Update Package Metadata

Edit `setup.py` and `pyproject.toml` to update:
- Your name and email
- GitHub repository URL
- Any other placeholders

### Step 2: Clean Previous Builds

```bash
cd /Users/r.vanderhorst/Documents/develop/learnportal/selenium_mcp_server
rm -rf dist/ build/ *.egg-info
```

### Step 3: Build Distribution Packages

```bash
python -m build
```

This creates:
- `dist/selenium_mcp_server-1.0.0.tar.gz` (source distribution)
- `dist/selenium_mcp_server-1.0.0-py3-none-any.whl` (wheel distribution)

### Step 4: Test Upload to Test PyPI (RECOMMENDED)

```bash
# Upload to test PyPI first
python -m twine upload --repository testpypi dist/*

# You'll be prompted for:
# Username: __token__
# Password: <your-test-pypi-token>
```

### Step 5: Test Installation from Test PyPI

```bash
# Try installing from test PyPI
pip install --index-url https://test.pypi.org/simple/ selenium-mcp-server

# Test it works
selenium-mcp --help
```

### Step 6: Upload to Production PyPI

If test installation works:

```bash
# Upload to production PyPI
python -m twine upload dist/*

# You'll be prompted for:
# Username: __token__
# Password: <your-production-pypi-token>
```

### Step 7: Verify on PyPI

Check your package is live:
- https://pypi.org/project/selenium-mcp-server/

Test installation:
```bash
pip install selenium-mcp-server
selenium-mcp --help
```

## Part 2: Publishing npm Package

### Step 1: Navigate to npm Wrapper

```bash
cd npm-wrapper
```

### Step 2: Update Package Metadata

Edit `package.json`:
- Update `author` field with your name/email
- Update repository URLs
- Confirm version is `1.0.0`

### Step 3: Test Package Locally

```bash
# Test the package works
npm test

# Check what will be published
npm pack --dry-run
```

### Step 4: Login to npm

```bash
npm login
# Enter your npm username, password, and email
```

Verify you're logged in:
```bash
npm whoami
```

### Step 5: Publish to npm

```bash
npm publish
```

**Note:** If the package name `selenium-mcp-server` is taken, you have two options:

**Option A: Use a scoped package**
```bash
# Update package.json name to: @your-username/selenium-mcp-server
npm publish --access public
```

**Option B: Choose a different name**
```bash
# Update package.json name to something unique like:
# selenium-mcp-fastmcp, selenium-test-mcp, etc.
npm publish
```

### Step 6: Verify on npm

Check your package is live:
- https://www.npmjs.com/package/selenium-mcp-server
- Or: https://www.npmjs.com/package/@your-username/selenium-mcp-server

Test installation:
```bash
npm install -g selenium-mcp-server
selenium-mcp --help
```

## Part 3: Post-Publishing

### Tag Your Release

```bash
cd /Users/r.vanderhorst/Documents/develop/learnportal/selenium_mcp_server

# Create a git tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# Or push all tags
git push --tags
```

### Update Documentation

Update README.md to reflect that packages are now available:
- Change installation instructions from "coming soon" to actual commands
- Update any placeholder URLs

### Create GitHub Release

1. Go to: https://github.com/yourusername/selenium-mcp-server/releases/new
2. Select tag: v1.0.0
3. Title: "v1.0.0 - Initial Release"
4. Description: List features and changes
5. Publish release

## Troubleshooting

### PyPI: "Package already exists"

The package name is taken. Options:
1. Choose a different name (update setup.py and pyproject.toml)
2. Contact the package owner if it's abandoned

### PyPI: "Invalid credentials"

Make sure you're using:
- Username: `__token__` (literally)
- Password: Your API token (starts with `pypi-`)

### PyPI: "File already exists"

You've already uploaded this version. Options:
1. Increment version in setup.py and pyproject.toml
2. Delete dist/ and rebuild

### npm: "Package already exists"

Use a scoped package:
```json
{
  "name": "@yourusername/selenium-mcp-server"
}
```

Then publish with:
```bash
npm publish --access public
```

### npm: "You do not have permission"

Make sure you're logged in:
```bash
npm whoami
npm login
```

## Setting Up API Token Storage (Optional)

### For PyPI

Create `~/.pypirc`:
```ini
[distutils]
index-servers =
    pypi
    testpypi

[pypi]
username = __token__
password = pypi-your-production-token-here

[testpypi]
username = __token__
password = pypi-your-test-token-here
```

Then you can upload without entering credentials:
```bash
python -m twine upload dist/*
```

### For npm

npm stores credentials automatically after `npm login`.

## Future Updates

### Update Python Package

```bash
# 1. Update version in setup.py and pyproject.toml
# 2. Clean and rebuild
rm -rf dist/ build/ *.egg-info
python -m build

# 3. Upload
python -m twine upload dist/*

# 4. Tag the release
git tag -a v1.0.1 -m "Release version 1.0.1"
git push --tags
```

### Update npm Package

```bash
cd npm-wrapper

# Update version (automatically updates package.json)
npm version patch  # 1.0.0 -> 1.0.1
# or
npm version minor  # 1.0.0 -> 1.1.0
# or
npm version major  # 1.0.0 -> 2.0.0

# Publish
npm publish

# Push version tag
git push --tags
```

## Checklist

### Before Publishing

- [ ] Update author information in setup.py
- [ ] Update author information in npm-wrapper/package.json
- [ ] Update GitHub repository URLs
- [ ] Test Python package locally: `pip install -e .`
- [ ] Test npm package locally: `npm test`
- [ ] All tests pass
- [ ] README is complete and accurate
- [ ] LICENSE file is present

### PyPI Publishing

- [ ] Created PyPI account (test and production)
- [ ] Created API tokens
- [ ] Cleaned build artifacts
- [ ] Built distributions: `python -m build`
- [ ] Uploaded to test PyPI
- [ ] Tested installation from test PyPI
- [ ] Uploaded to production PyPI
- [ ] Verified package on pypi.org
- [ ] Tested installation: `pip install selenium-mcp-server`

### npm Publishing

- [ ] Created npm account
- [ ] Logged in: `npm login`
- [ ] Updated package.json metadata
- [ ] Tested package locally
- [ ] Checked publish preview: `npm pack --dry-run`
- [ ] Published: `npm publish`
- [ ] Verified package on npmjs.com
- [ ] Tested installation: `npm install -g selenium-mcp-server`

### Post-Publishing

- [ ] Created git tag: v1.0.0
- [ ] Pushed tags to GitHub
- [ ] Created GitHub release
- [ ] Updated README with actual install commands
- [ ] Announced release (optional)

## Need Help?

- PyPI Help: https://pypi.org/help/
- npm Help: https://docs.npmjs.com/
- GitHub Releases: https://docs.github.com/en/repositories/releasing-projects-on-github

## Ready to Publish?

Let's do it! Start with PyPI test server, verify it works, then proceed to production for both PyPI and npm.
