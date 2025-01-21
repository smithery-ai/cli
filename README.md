# Smithery CLI ![NPM Version](https://img.shields.io/npm/v/%40smithery%2Fcli)

The Smithery registry installer and manager for Model Context Protocol (MCP) servers, designed to be client-agnostic.

## Requirements
- NodeJS version 18 or above

## Usage

```bash
npx @smithery/cli <command>
```

### Available Commands

- `installed` - List installed servers (interactive browser)
- `install <server>` - Install a server
  - `--client <name>` - Specify LLM client (e.g. claude)
- `uninstall <server>` - Remove an installed server
- `view <server>` - Show server details
- `inspect` - Interactive server inspection tool

### Examples

```bash
# Browse installed servers
npx @smithery/cli installed

# Install a server (defaults to --client claude)
npx @smithery/cli install mcp-obsidian

# Install for specific client
npx @smithery/cli install mcp-obsidian --client claude

# View server details
npx @smithery/cli view mcp-obsidian

# Remove a server
npx @smithery/cli uninstall mcp-obsidian

# Inspect installed servers
npx @smithery/cli inspect
```

### Important Notes

- Remember to restart Claude after uninstalling server
- Use the `inspect` command for interactive server testing
- Run without arguments to see the help menu

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
npx . list

# Get details about a specific server
npx . get <server-id>

# Install a server
npx . install <server-name>
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.