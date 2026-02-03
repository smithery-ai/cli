# Smithery CLI [![NPM Version](https://img.shields.io/npm/v/%40smithery%2Fcli)](https://www.npmjs.com/package/@smithery/cli) [![NPM Downloads](https://img.shields.io/npm/dt/%40smithery%2Fcli)](https://www.npmjs.com/package/@smithery/cli)

CLI for installing MCP servers and managing cloud connections via [Smithery](https://smithery.ai).

## Installation

```bash
npm install -g @smithery/cli
```

Requires Node.js 20+.

## Commands

### Local Server Management

```bash
smithery install <server>     # Install a server to an AI client
smithery uninstall <server>   # Remove a server
smithery list                 # List installed servers
smithery search [term]        # Search the Smithery registry
smithery inspect <server>     # Interactive server testing
smithery run <server>         # Run a server locally
```

Options: `--client <name>` to skip client selection, `--config <json>` to provide configuration.

### Smithery Connect (Cloud MCP)

Manage cloud-hosted MCP servers via [Smithery Connect](https://smithery.ai).

```bash
# Namespace context (auto-created on first use)
smithery namespace list       # List namespaces
smithery namespace use <name> # Set current namespace
smithery namespace show       # Show current namespace

# Server connections
smithery connect add <url>    # Add MCP server (--name for display name)
smithery connect list         # List connected servers
smithery connect remove <id>  # Remove a connection
smithery connect auth <id>    # Complete OAuth for a server

# Tools
smithery connect tools [server]     # List tools (all or for specific server)
smithery connect search <query>     # Fuzzy search tools by intent
smithery connect call <id> [args]   # Call a tool (format: server/tool-name)
```

### Development

```bash
smithery login                # Set API key
smithery dev [entry]          # Dev server with hot-reload and tunnel
smithery build [entry]        # Build for production
smithery playground           # Open interactive testing UI
```

## Examples

```bash
# Install a server
smithery install exa --client claude --config '{"exaApiKey":"xxx"}'

# Cloud MCP workflow
smithery connect add https://server.smithery.ai/github
smithery connect search "create issue"
smithery connect call github/create_issue '{"title":"Bug fix","body":"..."}'

# Development
smithery dev server.ts --port 3000
smithery build --out dist/server.cjs
```

## Development

```bash
git clone https://github.com/smithery-ai/cli
cd cli && npm install && npm run build
npx . --help
```

## Contributing

Contributions welcome! Please submit a Pull Request.
