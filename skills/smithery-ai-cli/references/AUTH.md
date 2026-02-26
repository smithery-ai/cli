# Authentication

Smithery uses OAuth for authentication. Your human must confirm login via browser.

## Login Flow

```bash
smithery auth login
```

This will:
1. Create an authentication session
2. Display a URL for your human to open
3. Poll until authentication is confirmed
4. Store the API key locally

**Tell your human**: "Please open this URL to authorize Smithery: [displayed URL]"

The CLI will wait up to 5 minutes for confirmation.

## Logout

To remove all local credentials:

```bash
smithery auth logout
```

This removes:
- API key from local settings
- Namespace configuration
- All server configurations from keychain

## Check Auth Status

```bash
smithery auth whoami
```

Shows masked API key. Use `--full` to show complete key:

```bash
smithery auth whoami --full
```

Output: `SMITHERY_API_KEY=sk_...`

## Serve API Key (For Programmatic Use)

Start a local server that serves your API key:

```bash
smithery auth whoami --server
```

This starts a server on `http://localhost:4260`. Fetch the key:

```bash
curl http://localhost:4260/whoami
# Returns: {"SMITHERY_API_KEY": "sk_...", "expiresAt": "..."}
```

The server automatically refreshes expired tokens.

## Mint Service Tokens

Create scoped service tokens for machine-to-machine use:

```bash
# Mint a default token (1h TTL)
smithery auth token

# Mint a restricted token with one constraint
smithery auth token --policy '{"resources": "connections", "operations": "read", "ttl": "30m"}'

# Mint a token with multiple constraints (repeat --policy)
smithery auth token --policy '{"namespaces": "prod", "operations": "read"}' --policy '{"resources": "skills", "ttl": "2h"}'

# Output as JSON
smithery auth token --json
```

Each `--policy` value is a single JSON constraint object. Specify `--policy` multiple times to add more constraints. Run `smithery auth token --help` to see the full JSON schema.

Constraint fields (all optional):
- `resources` - `"connections"`, `"servers"`, `"namespaces"`, `"skills"` (string or array)
- `operations` - `"read"`, `"write"`, `"execute"` (string or array)
- `namespaces` - Namespace name(s) to restrict to (string or array)
- `ttl` - Duration string (`"30m"`, `"1h"`) or seconds (max 24h, default 1h)
- `metadata` - Key-value pairs for fine-grained access control (object or array of objects)
- `rpcReqMatch` - MCP JSON-RPC request matching rules (object of dot-path keys to regex values, all must match)

### RPC-level filtering with `rpcReqMatch`

`rpcReqMatch` restricts which MCP JSON-RPC requests the token can make. Keys are dot-paths into the JSON-RPC request body. Values are regex patterns. All entries must match (AND).

The MCP JSON-RPC request body has this structure:

```json
{
  "method": "tools/call",
  "params": {
    "name": "search",
    "arguments": { "query": "weather" }
  }
}
```

Matchable fields include:
- `method` - The MCP method (e.g. `tools/call`, `tools/list`, `resources/read`, `resources/list`)
- `params.name` - The tool or resource name
- `params.arguments.<key>` - Specific argument values

**Note:** Connection/server IDs are NOT part of the JSON-RPC request body — they are handled at the transport layer. To restrict which connections a token can access, use the `metadata` constraint field instead.

Examples:

```bash
# Only allow calling a specific tool by name
smithery auth token --policy '{"rpcReqMatch": {"method": "tools/call", "params.name": "^search$"}}'

# Allow calling any tool whose name starts with "read_"
smithery auth token --policy '{"rpcReqMatch": {"method": "tools/call", "params.name": "^read_"}}'

# Only allow listing tools (no calling)
smithery auth token --policy '{"rpcReqMatch": {"method": "^tools/list$"}}'

# Restrict to a specific connection and only allow calling the "search" tool
smithery auth token --policy '{"metadata": {"connectionId": "my-connection-id"}, "rpcReqMatch": {"method": "tools/call", "params.name": "^search$"}}'
```

Tokens use Biscuit attenuation — they can only be narrowed, never expanded.

## Environment Variables

You can also set your API key via environment variable:

```bash
export SMITHERY_API_KEY="sk_your_api_key"
```

Priority order:
1. `SMITHERY_API_KEY` environment variable
2. Stored API key from `smithery auth login`

## Storage Location

API keys are stored in:
- macOS: `~/Library/Application Support/smithery/settings.json`
- Linux: `~/.config/smithery/settings.json`
- Windows: `%APPDATA%\smithery\settings.json`

Override with `SMITHERY_CONFIG_PATH` environment variable.

## Troubleshooting

**"No API key found"**: Run `smithery auth login` and have your human confirm.

**Login times out**: The 5-minute window expired. Run `smithery auth login` again.

**Invalid API key**: Your key may have expired. Run `smithery auth login` to get a fresh one.
