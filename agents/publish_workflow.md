# Publishing Workflow

This guide explains how the Smithery CLI publishing workflow works and how to manage releases.

## Overview

The publishing workflow automatically publishes new versions to npm when version tags are pushed to the main branch. It uses a tag-based approach that's standard in the npm ecosystem.

## Workflow Structure

### Triggers
- **Push to main branch** - Runs build and tests only
- **Push version tags (`v*`)** - Runs build, tests, and publishes to npm
- **Pull requests** - Runs build and tests only

### Jobs

#### 1. Build Job (Always Runs)
```yaml
build:
  runs-on: ubuntu-latest
  steps:
    - Checkout code
    - Setup Node.js 20 with npm cache
    - Install dependencies (npm ci)
    - Build project (npm run build)
    - Run checks (npm run check - linting/formatting)
```

#### 2. Publish Job (Only on Version Tags)
```yaml
publish:
  runs-on: ubuntu-latest
  if: startsWith(github.ref, 'refs/tags/v')
  needs: build
  steps:
    - Checkout code
    - Setup Node.js with npm registry
    - Install dependencies
    - Publish to npm with provenance
```

## How to Publish

### Method 1: Using npm version (Recommended)
```bash
# Patch release (1.3.0 → 1.3.1)
npm version patch

# Minor release (1.3.0 → 1.4.0)
npm version minor

# Major release (1.3.0 → 2.0.0)
npm version major

# Push the version tag
git push --follow-tags
```

### Method 2: One-liner
```bash
npm version patch && git push --follow-tags
```

### What happens automatically:
1. `npm version` updates `package.json` and creates a git tag
2. `git push --follow-tags` pushes both the commit and tag
3. GitHub workflow triggers on the version tag
4. Build job runs (tests, build, checks)
5. If build passes, publish job runs and publishes to npm

## Workflow Features

### Security
- **Provenance**: Uses `--provenance` flag for supply chain security
- **Access control**: Uses `--access public` for public packages
- **Token authentication**: Uses `NODE_AUTH_TOKEN` secret
- **Permissions**: Minimal required permissions (contents: read, id-token: write)

### Reliability
- **Dependency separation**: Build job must pass before publish
- **Concurrency control**: Prevents conflicting runs
- **Cache optimization**: Uses npm cache for faster builds
- **Clean installs**: Uses `npm ci` for reproducible builds

## Environment Setup

### Required Secrets
- `NPM_TOKEN`: npm authentication token with publish permissions

### Node.js Version
- Uses Node.js 20 (LTS)
- Matches the minimum version in `package.json` engines field

## Troubleshooting

### Common Issues

1. **Publish fails with authentication error**
   - Check that `NPM_TOKEN` secret is set correctly
   - Verify token has publish permissions for the package

2. **Build fails before publish**
   - Check that all tests pass locally
   - Ensure `npm run build` and `npm run check` work locally

3. **Tag not triggering publish**
   - Ensure tag starts with `v` (e.g., `v1.0.0`)
   - Check that tag was pushed: `git push --follow-tags`

4. **Version conflicts**
   - Ensure the version in `package.json` doesn't already exist on npm
   - Use `npm view @smithery/cli versions --json` to check existing versions

### Debugging Steps

1. **Check workflow runs**: Go to GitHub Actions tab
2. **Review build logs**: Look at both build and publish job logs
3. **Verify tag format**: Tags must match `v*` pattern
4. **Test locally**: Run `npm run build` and `npm run check` locally

## Best Practices

1. **Always test locally** before publishing
2. **Use semantic versioning** (patch/minor/major)
3. **Write meaningful commit messages** for version bumps
4. **Review changes** in package-lock.json after version updates
5. **Monitor npm** for successful publication after workflow completes

## Integration with Development Workflow

1. **Feature development**: Work on feature branches
2. **Pull requests**: Create PRs to main (triggers build tests)
3. **Merge to main**: Merge PR (triggers build tests)
4. **Version bump**: Run `npm version` when ready to publish
5. **Push tags**: Use `git push --follow-tags` to trigger publish

This workflow ensures reliable, automated publishing while maintaining quality through automated testing and builds.
