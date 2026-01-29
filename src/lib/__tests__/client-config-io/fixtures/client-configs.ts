import type { ClientMCPConfig } from "../../../../lib/client-config-io"

/**
 * Goose client fixtures
 */
export const gooseYamlWithStdioServer = `extensions:
  github:
    name: GitHub
    cmd: npx
    args:
      - -y
      - "@modelcontextprotocol/server-github"
    enabled: true
    envs:
      GITHUB_PERSONAL_ACCESS_TOKEN: "<YOUR_TOKEN>"
    type: stdio
    timeout: 300
`

export const gooseYamlWithHttpServer = `extensions:
  test-server:
    name: Test Server
    cmd: npx
    args: []
    enabled: true
    envs: {}
    type: http
    url: "https://server.smithery.ai/@test/server/mcp"
    timeout: 300
`

export const gooseStdioConfig: ClientMCPConfig = {
	mcpServers: {
		github: {
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-github"],
			env: {
				GITHUB_PERSONAL_ACCESS_TOKEN: "<YOUR_TOKEN>",
			},
		},
	},
}

export const gooseHttpConfig: ClientMCPConfig = {
	mcpServers: {
		"test-server": {
			type: "http",
			url: "https://server.smithery.ai/@test/server/mcp",
			headers: {},
		},
	},
}

export const gooseYamlWithExistingServer = `extensions:
  existing-server:
    name: Existing Server
    cmd: npx
    args:
      - -y
      - "@smithery/cli@latest"
      - run
      - existing-server
    enabled: true
    envs: {}
    type: stdio
    timeout: 300
`

export const gooseYamlWithOtherTopLevelKeys = `someOtherField: preserved-value
extensions:
  test-server:
    name: Test Server
    cmd: npx
    args: []
    enabled: true
    envs: {}
    type: stdio
    timeout: 300
`

/**
 * OpenCode client fixtures
 */
export const opencodeJsonWithStdioServer = {
	mcp: {
		"github-server": {
			type: "local",
			command: ["npx", "-y", "@test/server"],
			environment: {
				API_KEY: "test-key",
			},
		},
	},
	theme: "dark",
}

export const opencodeJsonWithHttpServer = {
	mcp: {
		"test-server": {
			type: "remote",
			url: "https://server.smithery.ai/@test/server/mcp",
			headers: {
				Authorization: "Bearer token",
			},
		},
	},
}

export const opencodeStdioConfig: ClientMCPConfig = {
	mcpServers: {
		"github-server": {
			command: "npx",
			args: ["-y", "@test/server"],
			env: {
				API_KEY: "test-key",
			},
		},
	},
}

export const opencodeHttpConfig: ClientMCPConfig = {
	mcpServers: {
		"test-server": {
			type: "http",
			url: "https://server.smithery.ai/@test/server/mcp",
			headers: {
				Authorization: "Bearer token",
			},
		},
	},
}

export const opencodeSimpleStdioConfig: ClientMCPConfig = {
	mcpServers: {
		"simple-server": {
			command: "npx",
			env: {
				KEY: "value",
			},
		},
	},
}

export const opencodeJsonWithExistingServer = {
	mcp: {
		"existing-server": {
			type: "local",
			command: ["npx", "-y", "@test/existing"],
			environment: {},
		},
	},
	theme: "dark",
}

export const opencodeJsonWithOtherFields = {
	theme: "light",
	model: "anthropic/claude-3",
	mcp: {
		"test-server": {
			type: "local",
			command: ["npx"],
			environment: {},
		},
	},
}

/**
 * Windsurf client fixtures
 */
export const windsurfJsonWithServerUrl = {
	mcpServers: {
		"test-server": {
			type: "http",
			serverUrl: "https://server.smithery.ai/@test/server/mcp",
			headers: {},
		},
	},
}

export const windsurfHttpConfig: ClientMCPConfig = {
	mcpServers: {
		"test-server": {
			type: "http",
			url: "https://server.smithery.ai/@test/server/mcp",
			headers: {},
		},
	},
}

export const windsurfJsonWithExistingServer = {
	mcpServers: {
		"existing-server": {
			type: "http",
			serverUrl: "https://server.smithery.ai/@existing/mcp",
			headers: {},
		},
	},
	someOtherField: "preserved",
}

/**
 * Cline client fixtures
 */
export const clineJsonWithStreamableHttp = {
	mcpServers: {
		"test-server": {
			type: "streamableHttp",
			url: "https://server.smithery.ai/@test/server/mcp",
			headers: {},
		},
	},
}

export const clineHttpConfig: ClientMCPConfig = {
	mcpServers: {
		"test-server": {
			type: "http",
			url: "https://server.smithery.ai/@test/server/mcp",
			headers: {},
		},
	},
}

export const clineJsonWithExistingServer = {
	mcpServers: {
		"existing-server": {
			type: "streamableHttp",
			url: "https://server.smithery.ai/@existing/mcp",
			headers: {},
		},
	},
	someOtherField: "preserved",
}

/**
 * Standard format fixtures (for clients like Claude Desktop, Cursor, etc.)
 */
export const standardJsonWithStdioServer = {
	mcpServers: {
		"test-server": {
			command: "npx",
			args: ["-y", "@smithery/cli@latest", "run", "test-server"],
		},
	},
}

export const standardStdioConfig: ClientMCPConfig = {
	mcpServers: {
		"test-server": {
			command: "npx",
			args: ["-y", "@smithery/cli@latest", "run", "test-server"],
		},
	},
}

export const standardYamlWithExistingServer = `mcpServers:
  existing-server:
    command: npx
    args:
      - -y
      - "@smithery/cli@latest"
      - run
      - existing-server
`
