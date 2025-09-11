# Smithery CLI ![NPM Version](https://img.shields.io/npm/v/%40smithery%2Fcli) ![NPM Downloads](https://img.shields.io/npm/dt/%40smithery%2Fcli)

The Smithery registry installer and manager for Model Context Protocol (MCP) servers, designed to be client-agnostic.

## Requirements
- NodeJS version 18 or above

## Usage

```bash
npx @smithery/cli <command>
```

### Available Commands

- `install <package>` - Install a package
  - `--client <name>` - Specify the AI client
  - `--config <json>` - Provide configuration data as JSON (skips prompts)
- `uninstall <package>` - Uninstall a package
  - `--client <name>` - Specify the AI client
- `inspect <server-id>` - Inspect a server interactively
- `run <server-id>` - Run a server
  - `--config <json>` - Provide configuration for the server
- `list clients` - List available clients
- `list servers --client <name>` - List installed servers for specific AI client
- `login` - Login with an API key (interactive)
- `dev [entryFile]` - Start development server with hot-reload and tunnel
  - `--port <port>` - Port to run the server on (default: 8181)
  - `--key <apikey>` - Provide an API key
  - `--no-open` - Don't automatically open the playground
  - `--prompt <prompt>` - Initial message to start the playground with
  - `-c, --config <path>` - Path to config file (default: auto-detect smithery.config.js)
- `build [entryFile]` - Build MCP server for production
  - `-o, --out <outfile>` - Output file path (default: .smithery/index.cjs)
  - `--transport <type>` - Transport type: shttp or stdio (default: shttp)
  - `-c, --config <path>` - Path to config file (default: auto-detect smithery.config.js)
- `playground` - Open MCP playground in browser
  - `--port <port>` - Port to expose (default: 3000)
  - `--key <apikey>` - Provide an API key
  - Can pass command after `--` separator
- `--help` - Show help message
- `--verbose` - Show detailed logs for debugging

### Examples

```bash
# Install a server (requires --client flag)
npx @smithery/cli install mcp-obsidian --client claude

# Install a server with pre-configured data (skips prompts)
npx @smithery/cli install mcp-obsidian --client claude --config '{"vaultPath":"path/to/vault"}'

# Remove a server
npx @smithery/cli uninstall mcp-obsidian --client claude

# List available clients
npx @smithery/cli list clients

# List installed servers for claude
npx @smithery/cli list servers --client claude

# Inspect a specific server from smithery's registry
npx @smithery/cli inspect mcp-obsidian

# Run a server with configuration
npx @smithery/cli run mcp-obsidian --config '{"key":"value"}'

# Login and set API key
npx @smithery/cli login

# Start development server with hot-reload
npx @smithery/cli dev
npx @smithery/cli dev server.ts --port 3000

# Build server for production
npx @smithery/cli build
npx @smithery/cli build server.ts --out dist/server.cjs --transport stdio

# Open playground in browser
npx @smithery/cli playground
npx @smithery/cli playground --port 3001 -- node dist/server.js

# Show help menu
npx @smithery/cli --help

# Install with verbose logging for debugging
npx @smithery/cli install mcp-obsidian --client claude --verbose
```

### Important Notes

- Use `login` command to set your Smithery API key (required for some operations)
- Remember to restart your AI client after installing or uninstalling servers
- Use the `inspect` command for interactive server testing
- Run without arguments to see the help menu
- Use `--verbose` flag for detailed logs when troubleshooting
- The `dev` command provides hot-reload for MCP server development
- Use `playground` to test your MCP servers in an interactive web interface

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
# List all servers
npx . list servers

# Inspect a specific server
npx . inspect <server-id>

# Install a server
npx . install <server-name> --client <client-name>

# Run with verbose logging
npx . <command> --verbose
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.