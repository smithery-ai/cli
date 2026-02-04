# Smithery Connect

Use MCP servers in the cloud without local installation. Connect to any server and call tools directly.

## Add a Connection

```bash
smithery connect add "https://server.smithery.ai/namespace/server-name"
```

Options:
- `--id <id>` - Custom connection ID
- `--name <name>` - Human-readable name
- `--metadata <json>` - Custom metadata as JSON
- `--namespace <ns>` - Target namespace

Example with options:
```bash
smithery connect add "https://server.smithery.ai/example/github" \
  --id "my-github" \
  --name "GitHub Tools" \
  --metadata '{"env": "production"}'
```

## List Connections

```bash
smithery connect list
```

Options:
- `--namespace <ns>` - List from specific namespace

Output (JSON):
```json
{
  "servers": [
    {"id": "abc123", "name": "GitHub Tools", "status": "connected"}
  ]
}
```

## Remove a Connection

```bash
smithery connect remove <connection-id>
```

Options:
- `--namespace <ns>` - Namespace for the connection

## Create or Update (Idempotent)

Use `set` to create or update a connection with a specific ID:

```bash
smithery connect set "https://server.smithery.ai/example/server" --id "my-server"
```

This is idempotent - safe to run multiple times.

## List Tools

List all tools from all connections:
```bash
smithery connect tools
```

List tools from a specific connection:
```bash
smithery connect tools my-github
```

Options:
- `--namespace <ns>` - Namespace to list from

Output (JSON):
```json
{
  "tools": [
    {
      "id": "my-github/create_issue",
      "name": "create_issue",
      "connection": "my-github",
      "description": "Create a GitHub issue"
    }
  ]
}
```

## Search Tools

Fuzzy search across all tools:

```bash
smithery connect search "create issue"
```

Options:
- `--namespace <ns>` - Namespace to search in

## Call a Tool

Call a tool using `connection-id/tool-name` format:

```bash
smithery connect call "my-github/create_issue" '{"repo": "owner/repo", "title": "Bug"}'
```

Options:
- `--namespace <ns>` - Namespace for the tool

Arguments are passed as JSON. For complex arguments:

```bash
smithery connect call "my-server/query" '{
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
smithery connect add "https://server.smithery.ai/smithery/github"

# 2. List available tools
smithery connect tools

# 3. Search for what you need
smithery connect search "pull request"

# 4. Call the tool
smithery connect call "abc123/create_pull_request" '{"repo": "...", "title": "..."}'
```
