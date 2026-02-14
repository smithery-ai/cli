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

# Mint a restricted token with a policy
smithery auth token --policy '[{"resources": ["connections"], "operations": ["read"], "ttl": "30m"}]'

# Output as JSON
smithery auth token --json
```

Policy constraints (all optional):
- `resources` - `"connections"`, `"servers"`, `"namespaces"`, `"skills"` (string or array)
- `operations` - `"read"`, `"write"`, `"execute"` (string or array)
- `namespaces` - Namespace name(s) to restrict to (string or array)
- `ttl` - Duration string (`"30m"`, `"1h"`) or seconds (max 24h, default 1h)
- `metadata` - Key-value pairs for fine-grained access control

A single constraint object is automatically wrapped in an array.

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
