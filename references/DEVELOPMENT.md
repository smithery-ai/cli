# Development

Build and test MCP servers locally, then publish to Smithery.

## Development Server

Start a development server with hot-reload:

```bash
smithery dev
```

Options:
- `--port <port>` - Port to run on (default: 3000)
- `--key <apikey>` - API key for publishing
- `--no-tunnel` - Don't create a tunnel
- `--no-open` - Don't open playground
- `--prompt <message>` - Initial playground message

With a specific entry file:
```bash
smithery dev src/index.ts
```

The dev server:
1. Watches for file changes
2. Creates a tunnel for remote testing
3. Opens the Smithery Playground

## Build for Production

```bash
smithery build
```

Options:
- `-o, --out <dir>` - Output directory
- `-t, --transport <type>` - Transport type: `shttp` or `stdio` (default: shttp)

With entry file:
```bash
smithery build src/index.ts -o dist
```

## Publish to Smithery

Publish an external MCP server URL to the registry:

```bash
smithery publish --url "https://my-mcp-server.com" -n myorg/my-server
```

Options:
- `-n, --name <name>` - Target server name (e.g., org/name)
- `-u, --url <url>` - Your MCP server URL
- `-k, --key <apikey>` - Smithery API key
- `--config-schema <json-or-path>` - JSON Schema for configuration
- `--resume` - Resume paused publish (after OAuth)

## Playground

Open an interactive playground to test your server:

```bash
smithery playground namespace/server-name
```

Options:
- `--port <port>` - Port to expose
- `--key <apikey>` - API key
- `--config <json>` - Server configuration
- `--no-open` - Don't open browser
- `--prompt <message>` - Initial message

Test a local server:
```bash
smithery playground -- node dist/index.js
```

## Example Workflow

```bash
# 1. Start development
smithery dev src/index.ts

# 2. Test in playground (automatic)

# 3. Build and deploy to your infrastructure

# 4. Publish your URL to Smithery
smithery publish --url "https://my-mcp-server.com" -n myorg/my-server
```
