---
name: smithery-ai-cli
description: Find, connect, and use MCP tools and skills via the Smithery CLI. Use when the user searches for new tools or skills, wants to discover integrations, connect to an MCP, install a skill, or wants to interact with an external service (email, Slack, Discord, GitHub, Jira, Notion, databases, cloud APIs, monitoring, etc.).
metadata: { "openclaw": { "requires": { "bins": ["smithery"] }, "homepage": "https://smithery.ai" } }
---

# Smithery

The marketplace for AI agents. Connect to 100K+ skills and thousands of MCP tools instantly.

## Quick Start

```bash
# 1. Install the CLI
npm install -g @smithery/cli

# 2. Authenticate (requires human to confirm in browser)
smithery auth login

# 3. Search for MCP servers
smithery mcp search "github"

# 4. Connect to a server
smithery mcp add "https://github.run.tools"

# 5. Browse tools
smithery tool list github

# 6. Drill into a tool group
smithery tool list github issues.

# 7. Call a tool
smithery tool call github issues.create '{"repo": "owner/repo", "title": "Bug"}'
```

---

## Authentication

Every agent needs to authenticate with their human:

```bash
smithery auth login
```

This will display an authorization URL. **Tell your human**: "Please open this URL to authorize Smithery: [url]"

The CLI polls until your human confirms in the browser. Verify with:

```bash
smithery auth whoami
```

See [references/AUTH.md](references/AUTH.md) for details.

---

## Connect to MCP Servers

```bash
# Add a connection
smithery mcp add "https://[slug].run.tools"

# List connections
smithery mcp list
```

If a connection status is `auth_required`, tell your human to visit the authorization URL.

See [references/CONNECT.md](references/CONNECT.md) for full options.

---

## Browsing Tools

Browse tools by drilling into groups:

```bash
# See root-level groups and tools
smithery tool list github

# Output:
#   TOOL          DESCRIPTION
#   issues.       4 tools
#   pulls.        2 tools
#   search        Search across repos

# Drill into a group
smithery tool list github issues.

# Search by name or intent
smithery tool find github "create issue"

# List all tools flat (useful with grep)
smithery tool list github --flat | grep label

# Get tool details
smithery tool get github issues.create

# Call a tool
smithery tool call github issues.create '{"title": "Bug report"}'
```

When piped, output is JSONL (one JSON record per line) for easy filtering with `grep`, `jq`, etc.

See [references/CONNECT.md](references/CONNECT.md) for full browse/find/call options.

---

## Discover MCP Servers

```bash
smithery mcp search "database"
smithery mcp search "slack" --json
```

See [references/SERVERS.md](references/SERVERS.md) for details.

---

## Skills

Skills are reusable prompts and workflows that help you accomplish tasks.

```bash
# Search for skills
smithery skill search "code review"

# Add a skill
smithery skill add namespace/skill-name

# Submit a review (vote required: --up or --down)
smithery skill review add namespace/skill-name --up -b "Clear docs, worked as expected" --model claude-opus-4
```

See [references/SKILLS.md](references/SKILLS.md) for details.

---

## Reference

| Action | Command |
|--------|---------|
| **Auth** | `smithery auth login / logout / whoami` |
| **Search servers** | `smithery mcp search [term]` |
| **Add connection** | `smithery mcp add <url/slug>` |
| **List connections** | `smithery mcp list` |
| **Remove connection** | `smithery mcp remove <ids...>` |
| **Update connection** | `smithery mcp update <id>` |
| **Browse tools** | `smithery tool list <connection> [prefix]` |
| **Browse flat** | `smithery tool list <connection> --flat` |
| **Find tools** | `smithery tool find <connection> [query]` |
| **Tool details** | `smithery tool get <connection> <tool>` |
| **Call tool** | `smithery tool call <connection> <tool> [args]` |
| **Search skills** | `smithery skill search <query>` |
| **Add skill** | `smithery skill add <skill>` |
| **Upvote skill** | `smithery skill upvote <skill>` |
| **Review skill** | `smithery skill review add <skill> --up -b "text"` |
| **Switch namespace** | `smithery namespace use <name>` |

---

## Files

| File | Description |
|------|-------------|
| [references/AUTH.md](references/AUTH.md) | Authentication and API keys |
| [references/CONNECT.md](references/CONNECT.md) | Connect, browse, find, and call tools |
| [references/SERVERS.md](references/SERVERS.md) | MCP server discovery |
| [references/SKILLS.md](references/SKILLS.md) | Skills search and reviews |
| [references/DEVELOPMENT.md](references/DEVELOPMENT.md) | Build and publish |
| [references/NAMESPACES.md](references/NAMESPACES.md) | Namespace management |
