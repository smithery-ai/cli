# Publishing

Publish an MCP server URL to Smithery.

## Publish Command

```bash
smithery mcp publish "https://my-mcp-server.com" -n myorg/my-server
```

Options:
- `-n, --name <name>` - Target server name (e.g., org/name)
- `-k, --key <apikey>` - Smithery API key
- `--config-schema <json-or-path>` - JSON Schema for server configuration
- `--resume` - Resume paused publish (after OAuth)

## Notes

- Public v4 docs only expose URL-based publishing.
- Development and playground commands are internal/hidden and not part of the public workflow.

## Example Workflow

```bash
# 1. Deploy your MCP server to your own infrastructure

# 2. Publish the hosted URL to Smithery
smithery mcp publish "https://my-mcp-server.com" -n myorg/my-server
```
