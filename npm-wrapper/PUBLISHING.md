# Publishing to npm

This guide explains how to publish the `selenium-mcp-server` npm wrapper package.

## Prerequisites

1. **npm account**: Create one at https://www.npmjs.com/signup
2. **npm CLI**: Should be installed with Node.js
3. **Login to npm**: Run `npm login` and enter your credentials

## Before Publishing

### 1. Update Version

Update the version in `package.json`:

```json
{
  "version": "1.0.0"  // Update this
}
```

Follow semantic versioning:
- **Major** (1.0.0 → 2.0.0): Breaking changes
- **Minor** (1.0.0 → 1.1.0): New features, backwards compatible
- **Patch** (1.0.0 → 1.0.1): Bug fixes

### 2. Test Locally

```bash
# Test the package locally
npm test

# Test installation from local directory
cd /tmp
npm install /path/to/selenium-mcp-server/npm-wrapper
npx selenium-mcp --help
```

### 3. Update Python Package Reference

Make sure the Python package is published to PyPI first:
- The npm wrapper installs `selenium-mcp-server` from PyPI
- Ensure the Python package version matches or is compatible

### 4. Review Files

Check what will be published:

```bash
npm pack --dry-run
```

This shows all files that will be included in the package.

## Publishing Steps

### 1. Login to npm

```bash
npm login
```

Enter your npm username, password, and email.

### 2. Publish

```bash
# Publish to npm
npm publish

# Or for scoped packages
npm publish --access public
```

### 3. Verify

Check that your package is live:

```bash
# View on npm
open https://www.npmjs.com/package/selenium-mcp-server

# Test installation
npm install -g selenium-mcp-server
selenium-mcp --help
```

## Publishing Process Checklist

- [ ] Python package published to PyPI
- [ ] Version number updated in package.json
- [ ] README.md is up to date
- [ ] All scripts tested locally
- [ ] `npm pack --dry-run` reviewed
- [ ] Logged into npm (`npm whoami` shows your username)
- [ ] `npm publish` executed
- [ ] Package verified on npmjs.com
- [ ] Test installation: `npm install -g selenium-mcp-server`
- [ ] Update GitHub repository with new tag

## Automated Publishing with GitHub Actions

You can automate publishing using GitHub Actions:

```yaml
# .github/workflows/publish-npm.yml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci
        working-directory: ./npm-wrapper

      - name: Publish to npm
        run: npm publish
        working-directory: ./npm-wrapper
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Then add `NPM_TOKEN` to your GitHub repository secrets.

## Updating After Publish

### Patch Release (Bug Fix)

```bash
npm version patch  # 1.0.0 → 1.0.1
npm publish
git push --tags
```

### Minor Release (New Feature)

```bash
npm version minor  # 1.0.0 → 1.1.0
npm publish
git push --tags
```

### Major Release (Breaking Change)

```bash
npm version major  # 1.0.0 → 2.0.0
npm publish
git push --tags
```

## Troubleshooting

### "Package already exists"

The package name is taken. Choose a different name or scope it:
- Change to: `@yourusername/selenium-mcp-server`
- Update package.json `name` field
- Publish with: `npm publish --access public`

### "Forbidden"

Make sure you're logged in:
```bash
npm whoami
npm login
```

### "No permission"

If the package already exists under a different account:
- Use a scoped package name: `@yourusername/selenium-mcp-server`
- Or choose a completely different name

## Best Practices

1. **Test before publishing**: Always test locally first
2. **Version properly**: Follow semver strictly
3. **Document changes**: Keep a CHANGELOG.md
4. **Coordinate with Python package**: Keep versions aligned
5. **Use CI/CD**: Automate publishing for consistency
6. **Tag releases**: Create git tags for each version

## Support

- npm documentation: https://docs.npmjs.com/
- Semantic versioning: https://semver.org/
- Publishing scoped packages: https://docs.npmjs.com/creating-and-publishing-scoped-public-packages
