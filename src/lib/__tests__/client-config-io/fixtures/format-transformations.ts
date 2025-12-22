import type { FormatDescriptor } from "../../../../config/format-descriptors"
import { FORMAT_DESCRIPTORS } from "../../../../config/format-descriptors"

/**
 * Standard format examples
 */
export const standardStdioConfig = {
	command: "npx",
	args: ["-y", "@test/server"],
	env: {
		KEY: "value",
	},
}

export const standardHttpConfig = {
	type: "http",
	url: "https://server.example.com/mcp",
	headers: {
		Authorization: "Bearer token",
	},
}

export const standardHttpConfigWithOAuth = {
	type: "http",
	url: "https://server.example.com/mcp",
	headers: {},
	oauth: {
		clientId: "test-client",
	},
}

/**
 * Client-specific format examples
 */

// Goose format
export const gooseStdioConfig = {
	cmd: "npx",
	args: ["-y", "@test/server"],
	envs: {
		KEY: "value",
	},
	type: "stdio",
}

export const gooseHttpConfig = {
	type: "http",
	url: "https://server.example.com/mcp",
	headers: {
		Authorization: "Bearer token",
	},
}

// OpenCode format
export const opencodeStdioConfig = {
	type: "local",
	command: ["npx", "-y", "@test/server"],
	environment: {
		KEY: "value",
	},
}

export const opencodeStdioConfigNoArgs = {
	type: "local",
	command: ["npx"],
	environment: {
		KEY: "value",
	},
}

export const opencodeHttpConfig = {
	type: "remote",
	url: "https://server.example.com/mcp",
	headers: {
		Authorization: "Bearer token",
	},
}

// Windsurf format
export const windsurfHttpConfig = {
	type: "http",
	serverUrl: "https://server.example.com/mcp",
	headers: {
		Authorization: "Bearer token",
	},
}

// Cline format
export const clineHttpConfig = {
	type: "streamableHttp",
	url: "https://server.example.com/mcp",
	headers: {
		Authorization: "Bearer token",
	},
}

/**
 * Test case fixtures
 */
export interface TransformationTestCase {
	name: string
	input: any
	expected: any
	descriptor: FormatDescriptor
	serverName?: string
}

/**
 * Test cases for transformToStandard
 */
export const transformToStandardCases: TransformationTestCase[] = [
	{
		name: "standard format pass-through (no transformation)",
		input: standardStdioConfig,
		expected: standardStdioConfig,
		descriptor: FORMAT_DESCRIPTORS.cline, // Using cline as it has minimal transformations
	},
	{
		name: "goose STDIO: cmd/envs/type → command/env/no type",
		input: gooseStdioConfig,
		expected: standardStdioConfig,
		descriptor: FORMAT_DESCRIPTORS.goose,
	},
	{
		name: "goose HTTP: preserves type and maps fields",
		input: gooseHttpConfig,
		expected: standardHttpConfig,
		descriptor: FORMAT_DESCRIPTORS.goose,
	},
	{
		name: "opencode STDIO: environment/local/array → env/no type/string+args",
		input: opencodeStdioConfig,
		expected: standardStdioConfig,
		descriptor: FORMAT_DESCRIPTORS.opencode,
	},
	{
		name: "opencode STDIO: array command with no args",
		input: opencodeStdioConfigNoArgs,
		expected: {
			command: "npx",
			env: {
				KEY: "value",
			},
		},
		descriptor: FORMAT_DESCRIPTORS.opencode,
	},
	{
		name: "opencode HTTP: remote → http",
		input: opencodeHttpConfig,
		expected: standardHttpConfig,
		descriptor: FORMAT_DESCRIPTORS.opencode,
	},
	{
		name: "windsurf HTTP: serverUrl → url",
		input: windsurfHttpConfig,
		expected: standardHttpConfig,
		descriptor: FORMAT_DESCRIPTORS.windsurf,
	},
	{
		name: "cline HTTP: streamableHttp → http",
		input: clineHttpConfig,
		expected: standardHttpConfig,
		descriptor: FORMAT_DESCRIPTORS.cline,
	},
	{
		name: "empty config returns empty object",
		input: {},
		expected: {},
		descriptor: FORMAT_DESCRIPTORS.goose,
	},
	{
		name: "null/undefined config returns as-is",
		input: null,
		expected: null,
		descriptor: FORMAT_DESCRIPTORS.goose,
	},
	{
		name: "opencode HTTP with oauth preserves oauth",
		input: {
			type: "remote",
			url: "https://server.example.com/mcp",
			headers: {},
			oauth: {
				clientId: "test-client",
			},
		},
		expected: standardHttpConfigWithOAuth,
		descriptor: FORMAT_DESCRIPTORS.opencode,
	},
]

/**
 * Test cases for transformFromStandard
 */
export const transformFromStandardCases: TransformationTestCase[] = [
	{
		name: "standard format pass-through (no transformation)",
		input: standardStdioConfig,
		expected: standardStdioConfig,
		descriptor: {
			topLevelKey: "mcpServers",
		},
		serverName: "test-server",
	},
	{
		name: "goose STDIO: command/env/no type → cmd/envs/type",
		input: standardStdioConfig,
		expected: gooseStdioConfig,
		descriptor: FORMAT_DESCRIPTORS.goose,
		serverName: "test-server",
	},
	{
		name: "goose HTTP: preserves type and maps fields",
		input: standardHttpConfig,
		expected: gooseHttpConfig,
		descriptor: FORMAT_DESCRIPTORS.goose,
		serverName: "test-server",
	},
	{
		name: "opencode STDIO: env/no type/string+args → environment/local/array",
		input: standardStdioConfig,
		expected: opencodeStdioConfig,
		descriptor: FORMAT_DESCRIPTORS.opencode,
		serverName: "test-server",
	},
	{
		name: "opencode STDIO: command only (no args) → array with single element",
		input: {
			command: "npx",
			env: {
				KEY: "value",
			},
		},
		expected: opencodeStdioConfigNoArgs,
		descriptor: FORMAT_DESCRIPTORS.opencode,
		serverName: "test-server",
	},
	{
		name: "opencode HTTP: http → remote",
		input: standardHttpConfig,
		expected: opencodeHttpConfig,
		descriptor: FORMAT_DESCRIPTORS.opencode,
		serverName: "test-server",
	},
	{
		name: "windsurf HTTP: url → serverUrl",
		input: standardHttpConfig,
		expected: windsurfHttpConfig,
		descriptor: FORMAT_DESCRIPTORS.windsurf,
		serverName: "test-server",
	},
	{
		name: "cline HTTP: http → streamableHttp",
		input: standardHttpConfig,
		expected: clineHttpConfig,
		descriptor: FORMAT_DESCRIPTORS.cline,
		serverName: "test-server",
	},
	{
		name: "empty config returns empty object",
		input: {},
		expected: {},
		descriptor: FORMAT_DESCRIPTORS.goose,
		serverName: "test-server",
	},
	{
		name: "null/undefined config returns as-is",
		input: null,
		expected: null,
		descriptor: FORMAT_DESCRIPTORS.goose,
		serverName: "test-server",
	},
	{
		name: "opencode HTTP with oauth preserves oauth",
		input: standardHttpConfigWithOAuth,
		expected: {
			type: "remote",
			url: "https://server.example.com/mcp",
			headers: {},
			oauth: {
				clientId: "test-client",
			},
		},
		descriptor: FORMAT_DESCRIPTORS.opencode,
		serverName: "test-server",
	},
	{
		name: "STDIO config without args field",
		input: {
			command: "npx",
			env: {
				KEY: "value",
			},
		},
		expected: {
			cmd: "npx",
			envs: {
				KEY: "value",
			},
			type: "stdio",
		},
		descriptor: FORMAT_DESCRIPTORS.goose,
		serverName: "test-server",
	},
	{
		name: "STDIO config without env field",
		input: {
			command: "npx",
			args: ["-y", "@test/server"],
		},
		expected: {
			cmd: "npx",
			args: ["-y", "@test/server"],
			type: "stdio",
		},
		descriptor: FORMAT_DESCRIPTORS.goose,
		serverName: "test-server",
	},
	{
		name: "HTTP config without headers",
		input: {
			type: "http",
			url: "https://server.example.com/mcp",
		},
		expected: {
			type: "http",
			url: "https://server.example.com/mcp",
		},
		descriptor: FORMAT_DESCRIPTORS.goose,
		serverName: "test-server",
	},
]
