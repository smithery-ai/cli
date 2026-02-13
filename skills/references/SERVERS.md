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

## Connect a Server

Add an MCP server connection:

```bash
smithery mcp add "https://server.smithery.ai/namespace/server-name"
```

Options:
- `--id <id>` - Custom connection ID
- `--name <name>` - Human-readable name
- `--namespace <ns>` - Target namespace

## List Connections

```bash
smithery mcp list
```

Options:
- `--namespace <ns>` - List from specific namespace

## Remove a Connection

```bash
smithery mcp remove <connection-id>
```

## Install Locally (deprecated)

Install a server for use with a specific client:

```bash
smithery mcp install namespace/server-name
```

Options:
- `-c, --client <name>` - Target client (claude, cursor, windsurf, etc.)
- `--config <json>` - Configuration as JSON (skips prompts)

Note: `install` is deprecated. Use `smithery mcp add <url>` to add connections instead.

## Example Workflow

```bash
# 1. Search for what you need
smithery mcp search "slack"

# 2. Connect to the server
smithery mcp add "https://server.smithery.ai/smithery/slack"

# 3. Verify connection
smithery mcp list
```
