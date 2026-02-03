# Smithery CLI [![NPM Version](https://img.shields.io/npm/v/%40smithery%2Fcli)](https://www.npmjs.com/package/@smithery/cli) [![NPM Downloads](https://img.shields.io/npm/dt/%40smithery%2Fcli)](https://www.npmjs.com/package/@smithery/cli)

The Smithery registry installer and manager for Model Context Protocol (MCP) servers, designed to be client-agnostic.

## Requirements
- NodeJS version 20 or above

## Installation

Install globally for easier usage:

```bash
npm install -g @smithery/cli
```

## Usage

```bash
smithery <command>
```

Or run directly without installation:

```bash
npx @smithery/cli <command>
```

### Available Commands

#### Local Server Management

- `install <server>` - Install a server (interactive client selection)
  - `--client <name>` - Specify the AI client (skips selection)
  - `--config <json>` - Provide configuration data as JSON (skips prompts)
- `uninstall <server>` - Uninstall a server (interactive client selection)
  - `--client <name>` - Specify the AI client (skips selection)
- `inspect <server-id>` - Inspect a server interactively
- `run <server-id>` - Run a server
  - `--config <json>` - Provide configuration for the server
- `list` - List installed servers (interactive client selection)
  - `--client <name>` - Specify the AI client (skips selection)
- `search [term]` - Search for servers in the Smithery registry (interactive)

#### Smithery Connect (Cloud MCP)

Manage cloud-hosted MCP server connections via [Smithery Connect](https://smithery.ai).

**Namespace Commands** - Manage namespace context (like kubectl config)

- `namespace list` - List available namespaces and show current
- `namespace use <name>` - Set current namespace (persisted)
- `namespace show` - Show current namespace
- `namespace create <name>` - Create and claim a new namespace

**Connect Commands** - Manage MCP server connections

- `connect add <mcp-url>` - Add an MCP server connection
  - `--name <name>` - Human-readable name for the server
  - `--namespace <ns>` - Target namespace (uses current if not specified)
- `connect list` - List connected servers
  - `--namespace <ns>` - Namespace to list from
- `connect remove <id>` - Remove a server connection
  - `--namespace <ns>` - Namespace for the server
- `connect auth <id>` - Handle OAuth for a server that requires authentication
  - `--namespace <ns>` - Namespace for the server
- `connect tools [server]` - List tools (all or for a specific server)
  - `--namespace <ns>` - Namespace to list from
- `connect search <query>` - Search tools by intent across all servers
  - `--namespace <ns>` - Namespace to search in
- `connect call <tool-id> [args]` - Call a tool directly
  - Tool ID format: `server/tool-name` (e.g., `googlecalendar/events_list`)
  - `--namespace <ns>` - Namespace for the tool

#### Authentication & Development

- `login` - Login with an API key (interactive)
- `dev [entryFile]` - Start development server with hot-reload and tunnel
  - `--port <port>` - Port to run the server on (default: 8081)
  - `--key <apikey>` - Provide an API key
  - `--no-open` - Don't automatically open the playground
  - `--prompt <prompt>` - Initial message to start the playground with
  - `-c, --config <path>` - Path to config file (default: auto-detect smithery.config.js)
- `build [entryFile]` - Build MCP server for production
  - `-o, --out <outfile>` - Output file path (default: .smithery/index.cjs)
  - `--transport <type>` - Transport type: shttp or stdio (default: shttp)
  - `-c, --config <path>` - Path to config file (default: auto-detect smithery.config.js)
- `playground` - Open MCP playground in browser
  - `--port <port>` - Port to expose (default: 8081)
  - `--key <apikey>` - Provide an API key
  - Can pass command after `--` separator
- `--help` - Show help message
- `--verbose` - Show detailed logs for debugging

### Examples

```bash
# Install a server (interactive client selection)
smithery install exa

# Install a server for specific client (skips selection)
smithery install exa --client claude

# Install a server with pre-configured data (skips prompts)
smithery install exa --client claude --config '{"exaApiKey":"you_api_key"}'

# Remove a server (interactive client selection)
smithery uninstall exa

# Remove a server from specific client (skips selection)
smithery uninstall exa --client claude

# List installed servers (interactive)
smithery list

# List installed servers for claude
smithery list --client claude

# Search for servers in the registry
smithery search "web search"

# Search interactively (prompts for term)
smithery search

# Inspect a specific server from smithery's registry
smithery inspect exa

# Run a server with configuration
smithery run exa --config '{"key":"value"}'

# Login and set API key
smithery login

# Start development server with hot-reload
smithery dev
smithery dev server.ts --port 3000

# Build server for production
smithery build
smithery build server.ts --out dist/server.cjs --transport stdio

# Open playground in browser
smithery playground
smithery playground --port 3001 -- node dist/server.js

# Show help menu
smithery --help

# Install with verbose logging for debugging
smithery install mcp-obsidian --client claude --verbose
```

### Smithery Connect Examples

```bash
# Set namespace context (required for connect commands)
smithery namespace use my-namespace

# Show current namespace
smithery namespace show

# List available namespaces
smithery namespace list

# Add an MCP server connection
smithery connect add https://mcp.example.com/sse --name "My Server"

# List connected servers
smithery connect list

# Search for tools by intent
smithery connect search "calendar events"

# Call a tool directly (server/tool-name format)
smithery connect call googlecalendar/events_list '{"calendarId":"primary"}'

# List tools for a specific server
smithery connect tools googlecalendar

# Remove a server connection
smithery connect remove googlecalendar

# Handle OAuth for a server that needs authentication
smithery connect auth github
```

### Important Notes

- Use `login` command to set your Smithery API key (required for most operations)
- Remember to restart your AI client after installing or uninstalling servers
- Use the `inspect` command for interactive server testing
- Run without arguments to see the help menu
- Use `--verbose` flag for detailed logs when troubleshooting
- The `dev` command provides hot-reload for MCP server development
- Use `playground` to test your MCP servers in an interactive web interface
- **Smithery Connect**: Use `namespace use` to set your context before using `connect` commands. The namespace is persisted and used by all subsequent connect operations.

## Development

This guide will help you get started with developing for @smithery/cli.

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/smithery-ai/cli
   cd cli
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

### Development Commands

```bash
# List installed servers
npx . list --client claude

# Search for servers
npx . search obsidian

# Inspect a specific server
npx . inspect <server-id>

# Install a server
npx . install <server-name> --client <client-name>

# Run with verbose logging
npx . <command> --verbose
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.