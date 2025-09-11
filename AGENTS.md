# Agent Guide: Adding New Clients

This guide helps you understand how to add new client configurations to the Smithery CLI.

## Overview

Client configurations define how MCP servers are installed for different AI clients (Claude, Cursor, VS Code, etc.). Each client has specific requirements for:
- **Target format**: json, yaml, toml, or command
- **Transport support**: stdio, http, or both
- **Installation method**: file-based or command-based

## Client Configuration Structure

Reference: `src/config/clients.ts`

```typescript
export interface ClientConfiguration {
  label: string                           // Human-readable name
  supportedTransports: Transport[]        // [Transport.STDIO] or [Transport.HTTP] or both
  installType: "json" | "command" | "yaml" | "toml"
  
  // File-based clients
  path?: string                          // Config file location
  
  // Command-based clients  
  command?: string                       // CLI command name
  commandConfig?: {
    stdio?: (name, command, args) => string[]  // STDIO install command
    http?: (name, url) => string[]             // HTTP install command
  }
  
  // Optional
  preferHTTP?: boolean                   // Prefer HTTP over STDIO when both available
  supportsOAuth?: boolean               // Client handles auth (no API key in URL)
}
```

## Adding a New Client

### Step 1: Determine Client Properties

**Target Type:**
- `json` - Writes to JSON config file
- `yaml` - Writes to YAML config file  
- `toml` - Writes to TOML config file
- `command` - Executes CLI commands

**Transport Support:**
- `[Transport.STDIO]` - Only supports STDIO servers
- `[Transport.HTTP]` - Only supports HTTP servers
- `[Transport.STDIO, Transport.HTTP]` - Supports both

**Installation Method:**
- **File-based**: Writes config to a file (json/yaml/toml targets)
- **Command-based**: Executes CLI commands (command target)

### Step 2: Add to CLIENT_CONFIGURATIONS

```typescript
export const CLIENT_CONFIGURATIONS: Record<string, ClientConfiguration> = {
  // ... existing clients ...
  
  "new-client": {
    label: "New AI Client",
    supportedTransports: [Transport.STDIO], // or [Transport.HTTP] or both
    installType: "json", // or "yaml", "toml", "command"
    
    // For file-based clients:
    path: path.join(homeDir, ".new-client", "config.json"),
    
    // For command-based clients:
    // command: "new-client-cli",
    // commandConfig: {
    //   stdio: (name, command, args) => ["add", name, command, ...args],
    //   http: (name, url) => ["add", "--http", name, url],
    // },
    
    // Optional:
    // preferHTTP: true,
    // supportsOAuth: true,
  },
}
```

### Step 3: Update Tests

Add test cases to `src/__tests__/install.test.ts`:

```typescript
// Add to TEST_CLIENT_CONFIGS
"new-client-stdio": {
  label: "New Client STDIO",
  supportedTransports: [Transport.STDIO],
  installType: "json",
  path: "/tmp/new-client.json",
},

// Add test case in appropriate target section
describe("target: json", () => {
  describe("transport: stdio", () => {
    test("should work with new-client", async () => {
      // Test implementation
    })
  })
})
```

## Examples by Category

### File-based JSON Client (Most Common)
```typescript
"claude": {
  label: "Claude Desktop",
  supportedTransports: [Transport.STDIO],
  installType: "json",
  path: path.join(baseDir, "Claude", "claude_desktop_config.json"),
}
```

### Command-based Client with Both Transports
```typescript
"claude-code": {
  label: "Claude Code", 
  supportedTransports: [Transport.HTTP, Transport.STDIO],
  installType: "command",
  preferHTTP: true,
  command: "claude",
  supportsOAuth: true,
  commandConfig: {
    stdio: (name, command, args) => ["mcp", "add", name, "--", command, ...args],
    http: (name, url) => ["mcp", "add", "--transport", "http", name, url],
  },
}
```

### YAML Client
```typescript
"librechat": {
  label: "LibreChat",
  supportedTransports: [Transport.STDIO],
  installType: "yaml",
  path: path.join(homeDir, "LibreChat", "librechat.yaml"),
}
```

### TOML Client  
```typescript
"codex": {
  label: "Codex",
  supportedTransports: [Transport.STDIO], 
  installType: "toml",
  path: path.join(homeDir, ".codex", "config.toml"),
}
```

## Platform-Specific Paths

Use the platform-specific path helpers:

```typescript
// Available variables:
const homeDir = os.homedir()
const { baseDir, vscodePath } = platformPaths[platform]

// Examples:
path.join(homeDir, ".client", "config.json")           // Cross-platform home
path.join(baseDir, "ClientName", "config.json")        // Platform app support dir  
path.join(baseDir, vscodePath, "extension", "config")  // VS Code extension path
```

## Testing Matrix Coverage

The test suite validates the **Target × Transport** matrix:

- **target: json** → transport: stdio, transport: http
- **target: yaml** → transport: stdio  
- **target: toml** → transport: stdio
- **target: command** → transport: stdio, transport: http

Ensure your new client fits into this matrix and add appropriate test cases.

## Key Points

1. **Client name** must be lowercase (used as CLI argument)
2. **File paths** should be platform-aware using provided helpers
3. **Command configs** return string arrays for CLI execution
4. **OAuth clients** don't include API keys in URLs
5. **HTTP preference** only matters when client supports both transports
6. **Test coverage** should include your client in the matrix validation
