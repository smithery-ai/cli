# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.46] - 2025-03-11

### Added
- Test suites for WebSocket runner (ws-runner.ts)

### Changed
- Removed npx resolution utility functions in favor of direct handling in stdio-runner.ts with Windows-specific workaround using `cmd /c`

## [1.1.45] - 2025-03-10

### Changed
- Refactored command organization by moving command files to dedicated `src/commands/` directory
- Updated import paths and documentation
- Logging runtime environment details in verbose mode 