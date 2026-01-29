/**
 * Fixture data for format transformation tests
 */

import type { ClientDefinition } from "../../../../config/clients"

/**
 * Mock client definitions for testing
 */
function mockStandardClient(): ClientDefinition {
	return {
		label: "Standard",
		install: { method: "file", format: "json", path: "/tmp/test.json" },
		transports: { stdio: {} },
	}
}

function mockGooseClient(): ClientDefinition {
	return {
		label: "Goose",
		install: { method: "file", format: "yaml", path: "/tmp/goose.yaml" },
		transports: {
			stdio: { typeValue: "stdio" },
			http: { supportsOAuth: true },
		},
		format: {
			topLevelKey: "extensions",
			fieldMappings: { command: "cmd", env: "envs" },
		},
	}
}

function mockOpencodeClient(): ClientDefinition {
	return {
		label: "OpenCode",
		install: { method: "file", format: "jsonc", path: "/tmp/opencode.jsonc" },
		transports: {
			stdio: { typeValue: "local", commandFormat: "array" },
			http: { typeValue: "remote", supportsOAuth: true },
		},
		format: {
			topLevelKey: "mcp",
			fieldMappings: { env: "environment" },
		},
	}
}

function mockWindsurfClient(): ClientDefinition {
	return {
		label: "Windsurf",
		install: { method: "file", format: "json", path: "/tmp/windsurf.json" },
		transports: {
			stdio: {},
			http: { supportsOAuth: true },
		},
		format: {
			fieldMappings: { url: "serverUrl" },
		},
	}
}

function mockClineClient(): ClientDefinition {
	return {
		label: "Cline",
		install: { method: "file", format: "json", path: "/tmp/cline.json" },
		transports: {
			stdio: {},
			http: { typeValue: "streamableHttp", supportsOAuth: true },
		},
	}
}

export const MOCK_CLIENTS = {
	standard: mockStandardClient,
	goose: mockGooseClient,
	opencode: mockOpencodeClient,
	windsurf: mockWindsurfClient,
	cline: mockClineClient,
}

/**
 * Standard format examples
 */
const standardStdioConfig = {
	command: "npx",
	args: ["-y", "@test/server"],
	env: {
		KEY: "value",
	},
}

const standardHttpConfig = {
	type: "http",
	url: "https://server.example.com/mcp",
	headers: {
		Authorization: "Bearer token",
	},
}

const standardHttpConfigWithOAuth = {
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
const gooseStdioConfig = {
	cmd: "npx",
	args: ["-y", "@test/server"],
	envs: {
		KEY: "value",
	},
	type: "stdio",
}

const gooseHttpConfig = {
	type: "http",
	url: "https://server.example.com/mcp",
	headers: {
		Authorization: "Bearer token",
	},
}

// OpenCode format
const opencodeStdioConfig = {
	type: "local",
	command: ["npx", "-y", "@test/server"],
	environment: {
		KEY: "value",
	},
}

const opencodeStdioConfigNoArgs = {
	type: "local",
	command: ["npx"],
	environment: {
		KEY: "value",
	},
}

const opencodeHttpConfig = {
	type: "remote",
	url: "https://server.example.com/mcp",
	headers: {
		Authorization: "Bearer token",
	},
}

// Windsurf format
const windsurfHttpConfig = {
	type: "http",
	serverUrl: "https://server.example.com/mcp",
	headers: {
		Authorization: "Bearer token",
	},
}

// Cline format
const clineHttpConfig = {
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
	input: Record<string, unknown> | null
	expected: Record<string, unknown> | null
	client: ClientDefinition
}

/**
 * Test cases for fromClientFormat (client → standard)
 */
export const fromClientFormatCases: TransformationTestCase[] = [
	{
		name: "standard format pass-through (no transformation)",
		input: standardStdioConfig,
		expected: standardStdioConfig,
		client: mockClineClient(),
	},
	{
		name: "goose STDIO: cmd/envs/type → command/env/no type",
		input: gooseStdioConfig,
		expected: standardStdioConfig,
		client: mockGooseClient(),
	},
	{
		name: "goose HTTP: preserves type and maps fields",
		input: gooseHttpConfig,
		expected: standardHttpConfig,
		client: mockGooseClient(),
	},
	{
		name: "opencode STDIO: environment/local/array → env/no type/string+args",
		input: opencodeStdioConfig,
		expected: standardStdioConfig,
		client: mockOpencodeClient(),
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
		client: mockOpencodeClient(),
	},
	{
		name: "opencode HTTP: remote → http",
		input: opencodeHttpConfig,
		expected: standardHttpConfig,
		client: mockOpencodeClient(),
	},
	{
		name: "windsurf HTTP: serverUrl → url",
		input: windsurfHttpConfig,
		expected: standardHttpConfig,
		client: mockWindsurfClient(),
	},
	{
		name: "cline HTTP: streamableHttp → http",
		input: clineHttpConfig,
		expected: standardHttpConfig,
		client: mockClineClient(),
	},
	{
		name: "empty config returns empty object",
		input: {},
		expected: {},
		client: mockGooseClient(),
	},
	{
		name: "null/undefined config returns as-is",
		input: null,
		expected: null,
		client: mockGooseClient(),
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
		client: mockOpencodeClient(),
	},
]

/**
 * Test cases for toClientFormat (standard → client)
 */
export const toClientFormatCases: TransformationTestCase[] = [
	{
		name: "standard format pass-through (no transformation)",
		input: standardStdioConfig,
		expected: standardStdioConfig,
		client: mockStandardClient(),
	},
	{
		name: "goose STDIO: command/env/no type → cmd/envs/type",
		input: standardStdioConfig,
		expected: gooseStdioConfig,
		client: mockGooseClient(),
	},
	{
		name: "goose HTTP: preserves type and maps fields",
		input: standardHttpConfig,
		expected: gooseHttpConfig,
		client: mockGooseClient(),
	},
	{
		name: "opencode STDIO: env/no type/string+args → environment/local/array",
		input: standardStdioConfig,
		expected: opencodeStdioConfig,
		client: mockOpencodeClient(),
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
		client: mockOpencodeClient(),
	},
	{
		name: "opencode HTTP: http → remote",
		input: standardHttpConfig,
		expected: opencodeHttpConfig,
		client: mockOpencodeClient(),
	},
	{
		name: "windsurf HTTP: url → serverUrl",
		input: standardHttpConfig,
		expected: windsurfHttpConfig,
		client: mockWindsurfClient(),
	},
	{
		name: "cline HTTP: http → streamableHttp",
		input: standardHttpConfig,
		expected: clineHttpConfig,
		client: mockClineClient(),
	},
	{
		name: "empty config returns empty object",
		input: {},
		expected: {},
		client: mockGooseClient(),
	},
	{
		name: "null/undefined config returns as-is",
		input: null,
		expected: null,
		client: mockGooseClient(),
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
		client: mockOpencodeClient(),
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
		client: mockGooseClient(),
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
		client: mockGooseClient(),
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
		client: mockGooseClient(),
	},
]
