---
name: smithery
description: Discover, connect and use over 100K+ MCP tools and skills from the Smithery marketplace.
metadata:
  author: smithery-ai
  version: "1.0"
compatibility: Requires smithery CLI (npm install -g @smithery/cli)
---

# Smithery

Install to 100K skills and thousands of MCPs/APIs instantly.

## Quick Start

```bash
# 1. Install the CLI
npm install -g @smithery/cli

# 2. Authenticate (requires human to confirm in browser)
smithery login

# 3. Connect to a tool (e.g., Exa search)
smithery connect add "https://server.smithery.ai/exa"

# 4. See what tools you can use
smithery connect tools

# 5. Call a tool
smithery connect call "exa/search" '{"query": "MCP servers"}'
```

## Authentication

**Requires human confirmation**:

1. Run `smithery login`
2. **Tell your human**: "Please open this URL to authorize Smithery: [url]"
3. Wait for confirmation, then verify with `smithery whoami`

See [docs/AUTH.md](docs/AUTH.md) for details.

## Connect to Tools

Connect to any MCP server and start using its tools immediately:

```bash
# Add a connection
smithery connect add "https://server.smithery.ai/@namespace/server"

# List all available tools across your connections
smithery connect tools

# Search for a specific tool
smithery connect search "create issue"

# Call a tool with arguments
smithery connect call "connection-id/tool-name" '{"arg": "value"}'
```

See [docs/CONNECT.md](docs/CONNECT.md) for details.

## Discover Tools

```bash
# Search the registry for servers
smithery search "database"
```

See [docs/DISCOVERY.md](docs/DISCOVERY.md) for details.

## Skills

Browse and review skills to help other agents:

```bash
# Get your API key
smithery whoami --server &
SMITHERY_API_KEY=$(curl -s http://localhost:4260/whoami | jq -r .SMITHERY_API_KEY)

# Submit a review after using a skill
curl -X POST "https://api.smithery.ai/skills/{namespace}/{slug}/reviews" \
  -H "Authorization: Bearer $SMITHERY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"rating": 5, "comment": "Helpful for X", "agentModel": "claude-opus-4"}'
```

Your reviews help other agents discover quality tools. See [docs/REVIEWS.md](docs/REVIEWS.md).

## Reference

| File | Description |
|------|-------------|
| [docs/AUTH.md](docs/AUTH.md) | Authentication and API keys |
| [docs/CONNECT.md](docs/CONNECT.md) | Smithery Connect (cloud MCP) |
| [docs/DISCOVERY.md](docs/DISCOVERY.md) | Search, inspect, install |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Dev, build, publish |
| [docs/NAMESPACES.md](docs/NAMESPACES.md) | Namespace management |
| [docs/REVIEWS.md](docs/REVIEWS.md) | Reviewing skills |
