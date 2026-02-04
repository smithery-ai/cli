# Contributing to Smithery CLI

Thank you for your interest in contributing to the Smithery CLI!

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/smithery-ai/cli.git
   cd cli
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the project:
   ```bash
   pnpm run build
   ```

4. Run tests:
   ```bash
   pnpm test
   ```

## Making Changes

1. Create a new branch for your changes
2. Make your changes following the code style (enforced by Biome)
3. Run `pnpm run check` to lint and format your code
4. Run `pnpm test` to ensure tests pass
5. Submit a pull request

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automated versioning and changelog generation.

### Commit Types

| Type | Description | Version Bump |
|------|-------------|--------------|
| `feat` | New feature | Minor |
| `fix` | Bug fix | Patch |
| `perf` | Performance improvement | Patch |
| `docs` | Documentation only | None |
| `chore` | Maintenance tasks | None |
| `refactor` | Code refactoring | None |
| `test` | Adding/updating tests | None |
| `ci` | CI/CD changes | None |

### Examples

```bash
feat: add support for Claude Desktop on Linux
fix: resolve config file parsing error on Windows
docs: update installation instructions
chore: update dependencies
```

### Breaking Changes

For breaking changes, add `!` after the type or include `BREAKING CHANGE:` in the commit body:

```bash
feat!: change default config location

BREAKING CHANGE: Config files are now stored in ~/.smithery instead of ~/.config/smithery
```

## Release Process

Releases are fully automated using [Release Please](https://github.com/googleapis/release-please).

### How It Works

1. **Merge PRs to main** - Use conventional commit messages
2. **Release PR created automatically** - Release Please creates a PR with:
   - Version bump in `package.json`
   - Updated `CHANGELOG.md`
3. **Merge the Release PR** - This triggers:
   - A GitHub Release with release notes
   - Automatic npm publish

### Manual Release (Emergency)

If the automated publish fails, you can manually trigger the publish workflow:

1. Go to [Actions > Publish NPM](https://github.com/smithery-ai/cli/actions/workflows/publish.yml)
2. Click "Run workflow"
3. Select the main branch and run

## Code Style

- TypeScript with strict mode
- Biome for linting and formatting
- Run `pnpm run check` before committing

## Questions?

Open an issue or reach out to the maintainers.
