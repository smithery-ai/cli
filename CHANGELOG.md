# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.58]

### Changed
- Enhanced cleanup process in stdio-runner with better handling of client disconnections and process termination
- Added safety timeout for transport cleanup operations to ensure process termination

## [1.1.57]

### Changed
- Updated @modelcontextprotocol/sdk to v1.8.0 which fixes Windows spawn issues ([modelcontextprotocol/typescript-sdk#101](https://github.com/modelcontextprotocol/typescript-sdk/issues/101), [modelcontextprotocol/typescript-sdk#198](https://github.com/modelcontextprotocol/typescript-sdk/pull/198))

## [1.1.56]

### Added
- Added API key support to WebSocket runner for using saved configurations  

## [1.1.55] - 2025-03-27

### Changed
- Silenced WebSocket error logging for non-critical errors to improve UX in clients that surface console errors

## [1.1.54] - 2025-03-25

### Added
- Enhanced WebSocket error handling with specific handlers for connection errors (code -32000) and protocol errors (codes -32602, -32600)
- Added automatic reconnection attempt for server-initiated connection closures

## [1.1.53] - 2025-03-24

### Changed
- Updated server configuration handling to skip the `--config` flag when configuration is empty, for cleaner commands

## [1.1.52] - 2025-03-24

### Fixed
- Fixed destructuring issue in collectConfigValues() that was causing parsing error with inspect command

## [1.1.51] - 2025-03-25

### Changed
- Refactored the install command for better code organization and maintainability
- Enhanced API key handling to improve backward compatibility and isolate functions when API key is provided
- Optimized registry to reduce database calls by returning both server details and saved configuration in a single request

## [1.1.50] - 2025-03-22

### Fixed
- Updated `inspectServer` function to properly handle changes in configuration collection

## [1.1.49] - 2025-03-21

### Added
- Initial support for `--key` flag to authenticate and use servers through smithery (preparatory work, not yet functional)

### Changed
- Enhanced server configuration with improved validation

## [1.1.48] - 2025-03-17

### Fixed
- Replaced `normalizeServerId` with `getServerName` to prevent issues in Cursor due to long server names

## [1.1.47] - 2025-03-17

### Added
- Support server installation for Cursor since latest update (`0.47.x`) supports global mcp configuration (see [Cursor Changelog](https://www.cursor.com/changelog))

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