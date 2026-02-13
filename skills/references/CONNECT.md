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
    {"id": "abc123", "name": "GitHub Tools", "status": "connected"}
  ]
}
```

## Remove a Connection

```bash
smithery mcp remove <connection-id>
```

Options:
- `--namespace <ns>` - Namespace for the connection

## Create or Update (Idempotent)

Use `set` to create or update a connection with a specific ID:

```bash
smithery mcp set "my-server" "https://server.smithery.ai/example/server"
```

This is idempotent - safe to run multiple times.

## Find Tools

Find all tools across all connections:
```bash
smithery tools find --all
```

Find all tools from a specific connection:
```bash
smithery tools find --connection my-github --all
```

Options:
- `--namespace <ns>` - Namespace to search in
- `--connection <id>` - Restrict to one connection
- `--all` - Return all matches (disable pagination)

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

## Find by Query

Find tools by intent across all connections:

```bash
smithery tools find "create issue"
```

Options:
- `--namespace <ns>` - Namespace to search in
- `--match <mode>` - `fuzzy`, `substring`, or `exact`
- `--limit <n>` - Max results per page (default: 10)
- `--page <n>` - Page number (default: 1)

## Get Tool Details

Show one tool in detail (full description + schemas):

```bash
smithery tools get my-github/create_issue
```

Options:
- `--namespace <ns>` - Namespace for the tool
- `--json` - Output full details as JSON

## Call a Tool

Call a tool by specifying the connection and tool name:

```bash
smithery tools call my-github create_issue '{"repo": "owner/repo", "title": "Bug"}'
```

Options:
- `--namespace <ns>` - Namespace for the tool

Arguments are passed as JSON. For complex arguments:

```bash
smithery tools call my-server query '{
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

# 2. Find available tools
smithery tools find --all

# 3. Find what you need
smithery tools find "pull request"

# 4. Call the tool
smithery tools call github create_pull_request '{"repo": "...", "title": "..."}'
```
