# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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