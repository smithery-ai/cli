# Smithery Connect API Reference

## Base URLs

- `https://smithery.run/{namespace}` — Namespace-scoped connection management
- `https://smithery.run/{namespace}/{connectionId}/.tools` — Tool operations

## Authentication

All requests require: `Authorization: Bearer $SMITHERY_API_KEY`

API keys come from https://smithery.ai/account/api-keys or from the settings file at `~/Library/Application Support/smithery/settings.json`.

## Endpoints

### List Connections

```
GET /smithery.run/{namespace}
```

Response:
```json
{
  "connections": [
    {
      "connectionId": "linear",
      "name": "linear",
      "mcpUrl": "https://server.smithery.ai/linear",
      "status": { "state": "connected" }
    }
  ]
}
```

### Get Connection

```
GET /smithery.run/{namespace}/{connectionId}
```

### Create/Update Connection

```
PUT /smithery.run/{namespace}/{connectionId}
Content-Type: application/json

{
  "mcpUrl": "https://server.smithery.ai/linear",
  "name": "My Linear"
}
```

### List Tools

```
GET /smithery.run/{namespace}/{connectionId}/.tools
```

Response:
```json
{
  "tools": [
    {
      "name": "list_issues",
      "description": "...",
      "inputSchema": { "type": "object", "properties": {...} }
    }
  ]
}
```

### Call Tool

```
POST /smithery.run/{namespace}/{connectionId}/.tools/{toolName}
Content-Type: application/json

{ "assignee": "me", "includeArchived": false }
```

Response:
```json
{
  "content": [
    { "type": "text", "text": "{\"issues\": [...]}" }
  ]
}
```

Tool names with dots map to slash paths: `repo.search` → `/.tools/repo/search`.

## Connection States

| State | Meaning | Action |
|-------|---------|--------|
| `connected` | Ready | Call tools |
| `auth_required` | OAuth needed | Open `setupUrl` in browser |
| `input_required` | Missing config | Provide fields or visit `setupUrl` |
| `error` | Failed | Check `message` |

## Service Tokens (Scoped Access)

Mint restricted tokens for browser/mobile use:

```
POST https://api.smithery.ai/tokens
Authorization: Bearer $SMITHERY_API_KEY
Content-Type: application/json

{
  "policy": [{
    "namespaces": "my-app",
    "resources": "connections",
    "operations": ["read", "execute"],
    "ttl": "1h"
  }]
}
```
