# Smithery CLI [![NPM Version](https://img.shields.io/npm/v/%40smithery%2Fcli)](https://www.npmjs.com/package/@smithery/cli) [![NPM Downloads](https://img.shields.io/npm/dt/%40smithery%2Fcli)](https://www.npmjs.com/package/@smithery/cli)

Smithery CLI connects your agents to thousands of skills and MCP servers directly from the command line. To get started, simply run `npx skills add smithery/cli`.

## Installation

```bash
npm install -g @smithery/cli@latest
```
Requires Node.js 20+.

## Commands

### MCP Servers

```bash
smithery mcp search [term]              # Search the Smithery registry
smithery mcp add <url>                  # Add an MCP server connection
smithery mcp list                       # List your connections
smithery mcp remove <ids...>            # Remove connections
```

### Tools

Interact with tools from MCP servers connected via `smithery mcp`.

```bash
smithery tools find [query]             # Find tools across your connected MCP servers
smithery tools get <connection/tool>    # Show full details for one tool
smithery tools call <connection> <tool> [args]  # Call a tool
```

### Skills

Browse and install skills from the [Smithery Skills Registry](https://smithery.ai/skills).

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

### Auth

```bash
smithery auth login                     # Login with Smithery (OAuth)
smithery auth logout                    # Log out
smithery auth whoami                    # Check current user
smithery auth token                     # Mint a service token
smithery auth token --policy '<json>'   # Mint a restricted token
```

### Namespaces

```bash
smithery namespace list                 # List your namespaces
smithery namespace use <name>           # Set current namespace
```

### Publishing

```bash
smithery mcp publish <url> -n <org/server>  # Publish an MCP server URL
```

## Examples

```bash
# Search and connect to an MCP server
smithery mcp search "github"
smithery mcp add https://server.smithery.ai/github --id github

# Find and call tools from your connected MCP servers
smithery tools find "create issue"
smithery tools call github create_issue '{"title":"Bug fix","body":"..."}'

# Browse and install skills
smithery skills search "frontend" --json --page 2
smithery skills install anthropics/frontend-design --agent claude-code

# Publish your MCP server URL
smithery mcp publish "https://my-mcp-server.com" -n myorg/my-server
```

## Development

```bash
git clone https://github.com/smithery-ai/cli
cd cli && pnpm install && pnpm run build
npx . --help
```

## Contributing

Contributions welcome! Please submit a Pull Request.
