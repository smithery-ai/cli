# Authentication

Smithery uses OAuth for authentication. Your human must confirm login via browser.

## Login Flow

```bash
smithery login
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
smithery logout
```

This removes:
- API key from local settings
- Namespace configuration
- All server configurations from keychain

## Check Auth Status

```bash
smithery whoami
```

Shows masked API key. Use `--full` to show complete key:

```bash
smithery whoami --full
```

Output: `SMITHERY_API_KEY=sk_...`

## Serve API Key (For Programmatic Use)

Start a local server that serves your API key:

```bash
smithery whoami --server
```

This starts a server on `http://localhost:4260`. Fetch the key:

```bash
curl http://localhost:4260/whoami
# Returns: {"SMITHERY_API_KEY": "sk_...", "expiresAt": "..."}
```

The server automatically refreshes expired tokens.

## Environment Variables

You can also set your API key via environment variable:

```bash
export SMITHERY_BEARER_AUTH="sk_your_api_key"
```

Priority order:
1. `SMITHERY_BEARER_AUTH` environment variable
2. Stored API key from `smithery login`

## Storage Location

API keys are stored in:
- macOS: `~/Library/Application Support/smithery/settings.json`
- Linux: `~/.config/smithery/settings.json`
- Windows: `%APPDATA%\smithery\settings.json`

Override with `SMITHERY_CONFIG_PATH` environment variable.

## Troubleshooting

**"No API key found"**: Run `smithery login` and have your human confirm.

**Login times out**: The 5-minute window expired. Run `smithery login` again.

**Invalid API key**: Your key may have expired. Run `smithery login` to get a fresh one.
