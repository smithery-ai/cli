# Smithery CLI [![NPM Version](https://img.shields.io/npm/v/%40smithery%2Fcli)](https://www.npmjs.com/package/@smithery/cli) [![NPM Downloads](https://img.shields.io/npm/dt/%40smithery%2Fcli)](https://www.npmjs.com/package/@smithery/cli)

CLI for installing MCP servers and managing cloud connections via [Smithery](https://smithery.ai).

## Installation

```bash
npm install -g @smithery/cli
```
Requires Node.js 20+.

## Commands

### Servers

```bash
smithery install <server>     # Install a server to an AI client
smithery uninstall <server>   # Remove a server
smithery list                 # List installed servers
smithery search [term]        # Search the Smithery registry
smithery inspect <server>     # Interactive server testing
smithery run <server>         # Run a server locally
```

Options: `--client <name>` to skip client selection, `--config <json>` to provide configuration.

### Skills

Browse and install reusable prompt-based skills from the [Smithery Skills Registry](https://smithery.ai/skills).

```bash
smithery skills search [query]                        # Search skills
smithery skills install <skill> --agent <name>        # Install a skill
smithery skills upvote <skill>                        # Upvote a skill
smithery skills downvote <skill>                      # Downvote a skill

# Reviews
smithery skills review list <skill>                   # List reviews
smithery skills review add <skill> --up -b "text"     # Add review + vote
smithery skills review remove <skill>                 # Remove your review
smithery skills review upvote <skill> <review-id>     # Upvote a review
smithery skills review downvote <skill> <review-id>   # Downvote a review
```

### Namespaces

Discover public namespaces on Smithery.

```bash
smithery namespace search [query] # Search public namespaces (requires login)
```

Options: `--limit <n>`, `--has-skills`, `--has-servers`.

### Smithery Connect (Cloud MCP)

Manage cloud-hosted MCP servers via [Smithery Connect](https://smithery.ai).

```bash
# Namespace context (auto-created on first use)
smithery namespace list       # List your namespaces
smithery namespace use <name> # Set current namespace
smithery namespace show       # Show current namespace

# Server connections
smithery connect add <url>    # Add MCP server (--name for display name)
smithery connect list         # List connected servers
smithery connect remove <id>  # Remove a connection

# Tools
smithery connect tools [server]     # List tools (all or for specific server)
smithery connect search <query>     # Fuzzy search tools by intent
smithery connect call <id> [args]   # Call a tool (format: server/tool-name)
```

### Development

```bash
smithery login                # Login with Smithery (OAuth)
smithery dev [entry]          # Dev server with hot-reload and tunnel
smithery build [entry]        # Build for production
smithery playground           # Open interactive testing UI
```

## Examples

```bash
# Install a server locally
smithery install exa --client cursor

# Browse and install skills
smithery skills search "frontend" --json --page 2    # Paginated results
smithery skills search --namespace anthropics --json  # Filter by namespace
smithery skills install anthropics/frontend-design --agent claude-code

# Review and vote on skills
smithery skills review list anthropics/frontend-design
smithery skills review add anthropics/frontend-design --up -b "Handles responsive layouts well"
smithery skills review upvote anthropics/frontend-design 550e8400-e29b-41d4-a716-446655440000
smithery skills upvote anthropics/frontend-design

# Discover namespaces
smithery namespace search --has-skills  # Find namespaces with skills

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
cd cli && pnpm install && pnpm run build
npx . --help
```

## Contributing

Contributions welcome! Please submit a Pull Request.
