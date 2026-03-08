---
name: smithery-ai-cli
description: Find, connect, and use MCP tools and skills via the Smithery CLI. Use when the user searches for new tools or skills, wants to discover integrations, connect to an MCP, install a skill, create or run automations, or wants to interact with an external service (email, Slack, Discord, GitHub, Jira, Notion, databases, cloud APIs, monitoring, etc.).
metadata: { "openclaw": { "requires": { "bins": ["smithery"] }, "homepage": "https://smithery.ai" } }
---

# Smithery

The marketplace for AI agents. Connect to 100K+ tools and skills instantly.

Use `smithery --help` and `<command> --help` for flags, arguments, and full examples.
This skill focuses on concepts and canonical workflows.

## Quick Start

```bash
# 1. Install
npm install -g @smithery/cli

# 2. Authenticate (requires human to confirm in browser)
smithery auth login

# 3. Search for MCP servers
smithery mcp search "github"

# 4. Connect to a server (URL or qualified name both work)
smithery mcp add "https://github.run.tools" --id github

# 5. Browse tools (tree view — drill into groups by passing the prefix)
smithery tool list github
smithery tool list github issues.

# 6. Inspect tool input/output JSON schema
smithery tool get github issues.create

# 7. Call a tool
smithery tool call github issues.create '{"repo": "owner/repo", "title": "Bug"}'
```

## Core Concepts

### [Namespaces](https://smithery.ai/docs/concepts/namespaces.md)

A namespace is the workspace boundary for Smithery resources. Servers, connections, and skills all live in a namespace.
Use one namespace per app/environment (for example, `my-app-dev`, `my-app-prod`), then set it as your active context.
Canonical flow:

```bash
smithery namespace list
smithery namespace create my-app-prod
smithery namespace use my-app-prod
```

For namespace-specific flags and overrides, run `smithery namespace --help` and `smithery mcp --help`.

### [Connect (MCP Connections)](https://smithery.ai/docs/use/connect.md)

A connection is a managed, long-lived MCP session.
Smithery Connect handles OAuth flow, credential storage, token refresh, and session lifecycle.
Connection status model:
- `connected`: ready to list/call tools
- `auth_required`: human must open authorization URL
- `error`: inspect details and retry/fix config

Canonical flow (single user-scoped connection):

```bash
smithery mcp add https://github.run.tools \
  --id user-123-github \
  --metadata '{"userId":"user-123"}'

smithery mcp list --metadata '{"userId":"user-123"}'
smithery tool list user-123-github
```

If CLI shows `auth_required`, tell your human to open the URL and then retry.

### [Token Scoping](https://smithery.ai/docs/use/token-scoping.md)

Service tokens are restricted credentials for browser/mobile/agent usage.
Never pass a full API key to untrusted code.
Policy mental model:
- A token policy is one or more constraints
- In the CLI, pass one JSON object per `--policy` flag
- Fields inside one constraint are AND-ed (more fields = narrower)
- Lists and multiple constraints are OR-ed (more entries = wider)

Canonical user-scoped token:

```bash
smithery auth token --policy '{
  "namespaces": "my-app",
  "resources": "connections",
  "operations": ["read", "execute"],
  "metadata": { "userId": "user-123" },
  "ttl": "1h"
}'
```

### Request-level Tool Restrictions (`rpcReqMatch`, experimental)

Use `rpcReqMatch` to restrict specific MCP JSON-RPC requests (regex by request path).
Important: connection IDs are not in the JSON-RPC body, so combine:
- `metadata` for connection-level restriction
- `rpcReqMatch` for method/tool restriction

Canonical combined restriction:

```bash
smithery auth token --policy '{
  "resources": "connections",
  "operations": "execute",
  "metadata": { "connectionId": "my-github" },
  "rpcReqMatch": {
    "method": "tools/call",
    "params.name": "^issues\\."
  },
  "ttl": "30m"
}'
```

### [Automations](https://smithery.ai/docs/use/automations.md)

Automations are deterministic TypeScript scripts that call MCP tools without AI.
They live in `~/.smithery/automations/` and each file exports a `servers` array (MCP URLs) and a `run` function.
Smithery handles connection management and auth — the automation just calls tools.

Canonical flow:

```bash
# 1. Initialize the ~/.smithery project (once)
smithery automation init

# 2. Create an automation
smithery automation create create-linear-ticket

# 3. Edit ~/.smithery/automations/create-linear-ticket.ts
#    - Add server URLs to the servers array
#    - Implement the run function using ctx.callTool()

# 4. Run it with key=value arguments
smithery automation run create-linear-ticket ticket-name="Fix login bug" priority=high
```

Automation file structure:

```typescript
export const servers = ["https://server.smithery.ai/linear"]

export async function run(
  args: Record<string, string>,
  ctx: {
    callTool: (server: string, toolName: string, toolArgs: Record<string, unknown>) => Promise<unknown>
  },
) {
  const result = await ctx.callTool(
    "https://server.smithery.ai/linear",
    "create_issue",
    { title: args["ticket-name"], priority: args["priority"] }
  )
  console.log("Created:", result)
}
```

CRUD commands: `automation create`, `automation list`, `automation get`, `automation remove`.
On first run, connections are auto-created for each server URL. If auth is required, the CLI prints the authorization URL.

### Programmatic Automations (SDK)

The same automation context is available as a library import for any TypeScript project.
Install `@smithery/cli` and import `createAutomationContext` from `@smithery/cli/automation`.

```typescript
import { createAutomationContext } from "@smithery/cli/automation"

const ctx = await createAutomationContext({
  servers: ["https://server.smithery.ai/linear"],
  apiKey: process.env.SMITHERY_API_KEY, // or omit to use stored key
})

const result = await ctx.callTool(
  "https://server.smithery.ai/linear",
  "create_issue",
  { title: "Bug: login page broken", priority: "high" },
)
```

This works anywhere — standalone scripts, API routes, background jobs, CI pipelines, etc.
Connections are auto-created and MCP clients are managed for you, same as the CLI.
Pass `apiKey` explicitly (e.g. from env vars) instead of relying on `smithery auth login`.
Auth errors throw with an `authorizationUrl` property for your code to handle.

### Piped Output

When output is piped, Smithery commands emit JSONL (one JSON object per line):

```bash
smithery tool list github --flat --limit 1000 | grep label
```
