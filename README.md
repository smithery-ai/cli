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
- `uninstall <package>` - Uninstall a package
  - `--client <name>` - Specify the AI client
- `inspect <server-id>` - Inspect a server interactively
- `run <server-id>` - Run a server
  - `--config <json>` - Provide configuration for the server
- `--verbose` - Show detailed logs for debugging

### Examples

```bash
# Install a server (requires --client flag)
npx @smithery/cli install mcp-obsidian --client claude

# Remove a server
npx @smithery/cli uninstall mcp-obsidian --client claude

# Inpsect a specific server from smithery's registry
npx @smithery/cli inspect mcp-obsidian

# Run a server with configuration
npx @smithery/cli run mcp-obsidian --config '"{\\"key\\":\\"value\\"}"'

# Install with verbose logging for debugging
npx @smithery/cli install mcp-obsidian --client claude --verbose
```

### Important Notes

- Remember to restart your AI client after installing or uninstalling servers
- Use the `inspect` command for interactive server testing
- Run without arguments to see the help menu
- Use `--verbose` flag for detailed logs when troubleshooting

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
npx . <command>

# Inspect a specific server
npx . inspect <server-id>

# Install a server
npx . install <server-name> --client <client-name>

# Run with verbose logging
npx . <command> --verbose
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.