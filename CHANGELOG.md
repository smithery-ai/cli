# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).


## [3.12.0](https://github.com/smithery-ai/cli/compare/v3.11.0...v3.12.0) (2026-02-05)


### Features

* add --headers option to connect add/set commands ([#581](https://github.com/smithery-ai/cli/issues/581)) ([da2856d](https://github.com/smithery-ai/cli/commit/da2856d77f766d72655e668d3063381d30c793e2))


### Bug Fixes

* remove unused --print-link option from login command ([#583](https://github.com/smithery-ai/cli/issues/583)) ([9a5b830](https://github.com/smithery-ai/cli/commit/9a5b830fcfc55e855c97a4c2e881c1beadb19753))

## [3.11.0](https://github.com/smithery-ai/cli/compare/v3.10.1...v3.11.0) (2026-02-05)

### Features

* improve review add UX with GitHub-style syntax ([#580](https://github.com/smithery-ai/cli/issues/580)) ([52aeb1d](https://github.com/smithery-ai/cli/commit/52aeb1df451167854ae2c0a346b37d9b1dec656f))


## [3.10.0](https://github.com/smithery-ai/cli/compare/v3.9.0...v3.10.0) (2026-02-04)


### Features

* add comprehensive Smithery CLI skill [SMI-1367] ([#562](https://github.com/smithery-ai/cli/issues/562)) ([04ace79](https://github.com/smithery-ai/cli/commit/04ace79f9ceba978015e1882c302055028f90493))
* add logout command to remove all local credentials ([#574](https://github.com/smithery-ai/cli/issues/574)) ([1d6db88](https://github.com/smithery-ai/cli/commit/1d6db88c2e315a04db44001b97b165f65aaf64ee))
* add skills review and vote commands ([#568](https://github.com/smithery-ai/cli/issues/568)) ([9251cfd](https://github.com/smithery-ai/cli/commit/9251cfdd4b400667e6193d0ba2b23f12c318ee94))
* redesign skills review and vote CLI with gh-style commands ([#572](https://github.com/smithery-ai/cli/issues/572)) ([6463e37](https://github.com/smithery-ai/cli/commit/6463e37383b8b8d86d8ee286ca819f1b3b135e8d))


### Refactors

* use @smithery/api client for skills reviews ([#570](https://github.com/smithery-ai/cli/issues/570)) ([38957aa](https://github.com/smithery-ai/cli/commit/38957aa44b38e6c62390ffbc8c1aa25540e80bb1))

## [3.9.1](https://github.com/smithery-ai/cli/compare/v3.9.0...v3.9.1) (2026-02-05)

### Changed

* refactor skills review commands to use @smithery/api client instead of raw fetch ([#570](https://github.com/smithery-ai/cli/issues/570))
* update @smithery/api from 0.36.0 to 0.37.0

## [3.9.0](https://github.com/smithery-ai/cli/compare/v3.8.2...v3.9.0) (2026-02-04)

### Features

* add skills search and install commands ([#550](https://github.com/smithery-ai/cli/issues/550)) ([2b1c2db](https://github.com/smithery-ai/cli/commit/2b1c2db55a8e88c0e4720090ba6d3852c89fdea0))
  - `smithery skills search [query]` - interactive skill search and browsing
  - `smithery skills install <skill> --agent <name>` - install skills via Vercel Labs skills CLI
  - `smithery skills agents` - list available agents for installation
  - `smithery namespace search [query]` - search public namespaces
  - Options: `--json`, `--limit`, `--namespace`, `-g/--global`
* add skills review commands
  - `smithery skills reviews <skill>` - list reviews for a skill
  - `smithery skills review <skill>` - submit a text review (requires login)
  - `smithery skills review <skill> --delete` - delete your review
  - `smithery skills vote <skill> <review-id> --up|--down` - upvote/downvote a review
  - Options: `--json`, `--limit`, `--page`, `-t/--text`, `-m/--model`
* add `--page` option to `smithery skills search` for pagination
* add `--print-link` option to `smithery login` for agent-friendly authentication (prints URL without spinners/browser)
* add custom ID and metadata support to connect command ([#558](https://github.com/smithery-ai/cli/issues/558)) ([11c1484](https://github.com/smithery-ai/cli/commit/11c1484a6dcec5bc5ae3dbb2d07ade5ac8df748f))

### Bug Fixes

* use MCP client for listing tools instead of raw HTTP; ref SMI-1260 ([#563](https://github.com/smithery-ai/cli/issues/563)) ([79cb44d](https://github.com/smithery-ai/cli/commit/79cb44d9d66a3fdd01aef827c54a6072d5ab3145))
* upgrade @smithery/api and use new createConnection API ([#561](https://github.com/smithery-ai/cli/issues/561)) ([9241b59](https://github.com/smithery-ai/cli/commit/9241b59))
* allow SDK client to work without API key ([#556](https://github.com/smithery-ai/cli/issues/556)) ([d883dbe](https://github.com/smithery-ai/cli/commit/d883dbe7a6f8b6b9326ea7e6d2d55eeb989388ea))
* publish to npm in release-please workflow ([#565](https://github.com/smithery-ai/cli/issues/565)) ([94b3cdc](https://github.com/smithery-ai/cli/commit/94b3cdc0a7c401bd03003eff1ede550a4ee6cdf1))

### Performance Improvements

* lazy load command implementations to improve CLI startup ([#560](https://github.com/smithery-ai/cli/issues/560)) ([1f4a0e4](https://github.com/smithery-ai/cli/commit/1f4a0e49a4c665d360cd2e03d4887bf3f359f072))

### Tests

* add tests for public API patterns (skills and registry) ([#566](https://github.com/smithery-ai/cli/issues/566)) ([e394217](https://github.com/smithery-ai/cli/commit/e394217c1980b59804991f846b1eb33df67b3bf3))

## [3.5.0] - 2026-01-28

### Added
- `--config-schema` flag for `publish` command to specify JSON Schema for external URL servers (inline JSON or path to .json file)
- Post-publish tip suggesting `--config-schema` for external URL publishes without configuration

### Changed
- Renamed `deploy` command to `publish` (`deploy` remains as deprecated alias with warning)
- Consolidated CLI utilities into `cli-utils.ts` (qualified-name parsing, config masking, JSON parsing)

## [3.4.0] - 2025-01-27

### Added
- Asset bundling support for stdio deploys via `build.assets` field in `smithery.yaml` - allows including non-code files (data files, templates, configs) in MCPB bundles using glob patterns (#524)

## [3.3.3] - 2025-01-26

### Fixed
- Fixed qualified name parsing - simple names like `linear` now consistently resolve with `namespace="linear"` instead of empty namespace

### Changed
- Refactored `resolveServer()` to accept `{ namespace, serverName }` instead of qualified name string - callers now use centralized `parseQualifiedName()` utility

### Added
- New `parseQualifiedName()` utility in `src/utils/qualified-name.ts` for consistent qualified name parsing across the codebase
- Unit tests for qualified name parsing

## [2.0.0] - 2025-12-21

### Changed
- **BREAKING**: Store server configurations in OS keychain instead of remote storage for local servers. Configurations are now stored securely on the user's local machine using the system keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- **BREAKING**: Remote server configuration handling - OAuth-capable clients now use direct HTTP URLs without API keys. Configuration is handled through OAuth flow instead of CLI prompts
- For clients that don't support OAuth but need HTTP servers, use `mcp-remote` as a fallback transport
- Simplified server resolution API - removed `ResolveServerSource` enum and `apiKey` parameter from `resolveServer()` function
- Refactored configuration handling - split `session-config.ts` into focused modules: `user-config.ts` for config resolution and `server-config.ts` for server configuration formatting
- Updated `run` command to load configurations from keychain instead of remote storage

### Added
- OS keychain integration using `keytar` library for secure local configuration storage
- New `keychain.ts` module with `saveConfig()`, `getConfig()`, and `deleteConfig()` functions
- `mcp-remote` integration for non-OAuth clients connecting to HTTP servers
- Test coverage for user configuration resolution, server configuration formatting, and client configuration I/O operations
- Support for HTTP URL key customization (`httpUrlKey`), HTTP type overrides (`httpType`), and format descriptor support for client-specific configuration formats

### Removed
- Remote configuration storage for local servers
- `session-config.ts` module (functionality moved to `user-config.ts` and `server-config.ts`)
- Widget-related code (`widget-bundler.ts`, `widget-discovery.ts`, `widget-validation.ts`)
- Old test files (`install.test.ts`, `installation-flow.test.ts`, `registry.test.ts`, `config-to-args.test.ts`)
- `config-to-args.ts` utility (functionality integrated into other modules)

## [1.5.2] - 2025-10-14

### Fixed
- Fixed integration tests to use actual resolution functions instead of custom mocks in `prepare-stdio-connection.test.ts`
- Replaced subprocess calls to `npx @anthropic-ai/mcpb unpack` with direct imports from `@anthropic-ai/mcpb` library for better reliability and performance
- Improved stdio command creation for bundles to properly resolve environment variables and arguments from manifest.json using actual template resolution functions

### Added
- Tests for bundle manager covering template resolution, manifest parsing, and error conditions

## [1.5.0] - 2025-10-13

### Added
- Configuration validation flow during server installation with saved config detection
- Profile support across all configuration endpoints
- New tests covering installation flows and registry API calls

### Changed
- Updated configuration validation endpoint from `/config/:id/validate` to `/config/status/:id` for better semantics
- Improved configuration prompting: required fields first, then optional fields
- Enhanced installation UX with better messaging and visual indicators

### Fixed
- Fixed URL encoding bug for server names
- Fixed route pattern conflict in registry validation endpoint
- Fixed profile parameter not being passed to config operations

## [1.4.1] - 2025-09-27

### Added
- Integration tests for stateful/stateless server behavior validation

### Fixed
- Fixed config schema not being passed into server bundle

## [1.4.0] - TBD

### Added
- OAuth support

## [1.3.0] - 2025-09-12

### Added
- Created shared `cleanupChildProcess` utility for consistent process cleanup across commands
- Added bun bundler support in addition to esbuild - detected automatically at runtime with optional override with `--tool` option (note: only when using bun runtime for esbuild bundle; node doesn't allow bun api)

### Changed
- Updated Biome from v1.5.3 to v2.2.4 for better cross-platform binary support
- Updated biome.jsonc configuration for v2 compatibility
- Updated Node.js requirement from >=18.0.0 to >=20.0.0 to match dependency requirements
- Updated GitHub Actions to use Node.js 20
- Refactored `dev`, `playground`, and `uplink` commands to use shared child process cleanup utility
- Changed default output format from CommonJS to ESM modules
- Removed npm cache configuration from GitHub Actions workflows to resolve build issues

### Fixed
- Resolved `Cannot find module '@biomejs/cli-linux-x64/biome'` CI error
- Improve error handling in child process cleanup
- Improve race condition handling in process exit
- Fixed CI/CD build issues by removing npm cache configuration from workflow

## [1.2.29] - 2025-09-12

### Changed
- Refactored CLI command prompts by extracting prompt utilities from main index file to `src/utils/command-prompts.ts`
- Cleaned up unused dependencies: removed `@types/uuid` and `bufferutil` optional dependency
- Improved code organization and maintainability of CLI interface
- Added short form `-c` option as alias for `--client` across all commands (install, uninstall, list)

## [1.2.26] - 2025-09-11

### Added
- Interactive CLI commands: `smithery install`, `smithery uninstall`, and `smithery list` now support interactive client selection when no `--client` flag is provided
- New `search [term]` command for interactive server discovery in the Smithery registry
- Support for Codex client with TOML configuration format
- Comprehensive installation test suite covering Target × Transport matrix (json, yaml, toml, command × stdio, http)

### Changed
- Improved client configuration pattern with better structure and validation
- Updated command documentation and help text to reflect interactive capabilities

## [1.2.12] - 2025-01-05

### Changed
- Idle timeout (30 minutes) now only logs instead of closing connection
- Heartbeat stops on idle, resumes on activity
- Refactored idle manager to use callbacks

## [1.1.89] - 2025-05-01

### Changed
- Updated registry endpoint access to use [smithery/sdk](https://github.com/smithery-ai/sdk)
- Added proper process exit handling during installation

## [1.1.81] - 2025-04-29

### Added
- Added new API key prompt during installation of remote servers

## [1.1.80] - 2025-04-26

### Added
- Added support for profiles to allow multiple configurations per server

## [1.1.79] - 2025-04-26

### Changed
- Improved Streamable HTTP transport initisation by ensuring heartbeats only start after connection is established

## [1.1.78] - 2025-04-26

### Changed
- Removed API key requirement for local server installation
- Removed deprecated `fetchConfigWithApiKey` function
- Updated config collection flow to skip configuration prompts when API key is provided

## [1.1.75] - 2025-04-25

### Added
- Added session termination on transport close for Streamable HTTP runner

## [1.1.74] - 2025-04-25

### Added
- New Streamable HTTP runner as the primary connection method
- Refactored common connection utilities into `runner-utils` for better code organization

### Deprecated
- WebSocket transport is now deprecated in favor of Streamable HTTP transport

## [1.1.71] - 2025-04-18

### Changed
- Refactored config handling to treat empty strings ("") as undefined values
- Added stricter validation for required fields in configuration
- Improved process exit handling with proper exit code 0 on transport close
- Removed redundant config validation in and index.ts
- Streamlined config validation flow in config.ts

## [1.1.70] - 2025-04-17

### Changed
- Renamed roo-code to roocode for consistency

## [1.1.69] - 2025-04-17

### Changed
- Updated Roo Code (previously Roo Cline) configuration path

## [1.1.68] - 2025-04-12

### Changed
- Enhanced stdio and WS runners with more gracious error handling
- Improved logging in stdio runner with timestamps

## [1.1.67] - 2025-04-11

### Changed
- Unified error handling between WebSocket and STDIO runners by centralizing common error handling logic
- Improved error handling flow by letting parent handle process exits during protocol errors
- Enhanced verbose logging in inspect command to track server resolution, connection selection, and runtime environment setup
- Improved security by logging only configuration structure instead of sensitive values

## [1.1.66] - 2025-04-03

### Changed
- Modified runtime config validation to allow empty strings for required fields
- Added separate config validation for run vs install commands
- Improved error handling for missing required fields during runtime

## [1.1.65] - 2025-04-02

### Added
- Added WebSocket heartbeat mechanism that pings every 30 seconds to maintain connection
- Added 15-minute idle timeout with automatic connection shutdown

## [1.1.64] - 2025-04-01

### Fixed
- Fixed config parsing on Windows command prompt where single quotes were being passed literally instead of being interpreted

## [1.1.63] - 2025-04-01

### Added
- Added support for VS Code and VS Code Insiders

## [1.1.62] - 2025-03-31

### Added
- Added `list servers` command to display installed servers for a specific client

## [1.1.61] - 2025-03-30

### Changed
- Use API key for calling track

## [1.1.60] - 2025-03-30

### Changed
- Added random jitter (0-1000ms) to WebSocket reconnection backoff
- Refactored WebSocket runner and improved console logs

## [1.1.59] - 2025-03-30

### Changed
- Enhanced WebSocket runner cleanup process with improved handling of connection termination
- Added safety timeout for WebSocket transport cleanup operations
- Added better state management for clean vs unexpected shutdowns in WebSocket connections

## [1.1.58] - 2025-03-30

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
