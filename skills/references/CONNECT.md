# Smithery Connect

Use MCP servers in the cloud without local installation. Connect to any server and call tools directly.

## Add a Connection

```bash
smithery mcp add "https://server.smithery.ai/namespace/server-name"
```

Options:
- `--id <id>` - Custom connection ID
- `--name <name>` - Human-readable name
- `--metadata <json>` - Custom metadata as JSON
- `--namespace <ns>` - Target namespace

Example with options:
```bash
smithery mcp add "https://server.smithery.ai/example/github" \
  --id "my-github" \
  --name "GitHub Tools" \
  --metadata '{"env": "production"}'
```

## List Connections

```bash
smithery mcp list
```

Options:
- `--namespace <ns>` - List from specific namespace

Output (JSON):
```json
{
  "servers": [
    {"id": "abc123", "name": "GitHub Tools", "mcpUrl": "https://...", "status": "connected"}
  ],
  "total": 1,
  "hasMore": false
}
```

## Remove a Connection

```bash
smithery mcp remove <connection-id>
```

Options:
- `--namespace <ns>` - Namespace for the connection

## Update a Connection

Use `update` to modify a connection's name, metadata, or headers:

```bash
smithery mcp update "my-server" --name "My Server"
smithery mcp update "my-server" --metadata '{"env": "prod"}'
```

## List Tools

List all tools across all connections:
```bash
smithery tool list
```

List tools from a specific connection:
```bash
smithery tool list my-github
```

Options:
- `--namespace <ns>` - Namespace to list from
- `--limit <n>` - Maximum number of tools (default: 10)
- `--page <n>` - Page number (default: 1)

Output (JSON):
```json
{
  "tools": [
    {
      "name": "create_issue",
      "connection": "my-github",
      "description": "Create a GitHub issue"
    }
  ]
}
```

## Find Tools by Query

Search tools by name or intent across all connections:

```bash
smithery tool find "create issue"
```

Options:
- `--connection <id>` - Restrict to one connection
- `--namespace <ns>` - Namespace to search in
- `--match <mode>` - `fuzzy`, `substring`, or `exact`
- `--limit <n>` - Max results per page (default: 10)
- `--page <n>` - Page number (default: 1)
- `--all` - Return all matches without pagination

## Get Tool Details

Show one tool in detail (full description + schemas):

```bash
smithery tool get my-github create_issue
```

Options:
- `--namespace <ns>` - Namespace for the tool
- `--json` - Output full details as JSON

## Call a Tool

Call a tool by specifying the connection and tool name:

```bash
smithery tool call my-github create_issue '{"repo": "owner/repo", "title": "Bug"}'
```

Options:
- `--namespace <ns>` - Namespace for the tool

Arguments are passed as JSON. For complex arguments:

```bash
smithery tool call my-server query '{
  "sql": "SELECT * FROM users",
  "params": ["active"]
}'
```

## Output Handling

Tool responses are returned as JSON:
- Small outputs (<2KB): Returned inline
- Medium outputs (2-20KB): Preview + temp file reference
- Large outputs (>20KB): Summary + temp file reference

## Connection Status

Connections can have these states:
- `connected` - Ready to use
- `auth_required` - Needs authorization (check `authorizationUrl`)
- `error` - Connection failed (check error message)

If `auth_required`, tell your human to visit the authorization URL.

## Example Workflow

```bash
# 1. Add a connection
smithery mcp add "https://server.smithery.ai/smithery/github"

# 2. List available tools
smithery tool list

# 3. Search for what you need
smithery tool find "pull request"

# 4. Call the tool
smithery tool call github create_pull_request '{"repo": "...", "title": "..."}'
```
