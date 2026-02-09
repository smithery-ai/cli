# MCP Servers

Find, explore, and install MCP servers from the Smithery registry.

## Search Servers

Interactive search:
```bash
smithery mcp search
```

Search with a term:
```bash
smithery mcp search "database"
```

JSON output for programmatic use:
```bash
smithery mcp search "github" --json
```

Output:
```json
{
  "servers": [
    {
      "qualifiedName": "smithery/github",
      "displayName": "GitHub MCP Server",
      "description": "Interact with GitHub repositories"
    }
  ]
}
```

## Install Locally

Install a server for use with a specific client:

```bash
smithery install namespace/server-name
```

Options:
- `-c, --client <name>` - Target client (claude, cursor, windsurf, etc.)
- `--config <json>` - Configuration as JSON (skips prompts)

Example with config:
```bash
smithery install smithery/github -c claude --config '{"token": "ghp_..."}'
```

Supported clients:
- `claude` - Claude Desktop
- `cursor` - Cursor IDE
- `windsurf` - Windsurf IDE
- `cline` - Cline extension
- `witsy` - Witsy
- `enconvo` - Enconvo
- `claudecode` - Claude Code

## List Installed Servers

```bash
smithery mcp list
```

Options:
- `-c, --client <name>` - List for specific client

## Uninstall a Server

```bash
smithery uninstall server-name
```

Options:
- `-c, --client <name>` - Target client

## Run a Server Locally

Run a server without installing:

```bash
smithery mcp run namespace/server-name
```

Options:
- `--config <json>` - Configuration as JSON

## Example Workflow

```bash
# 1. Search for what you need
smithery mcp search "slack"

# 2. Install for your client
smithery install smithery/slack -c claude

# 3. Verify installation
smithery mcp list -c claude
```
