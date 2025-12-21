import type { ServerConfig } from "../../../../types/registry"

export const collectedConfigs = {
	requiredAndOptional: {
		apiKey: "test-api-key",
		endpoint: "https://test.example.com",
		debugMode: true,
		maxRetries: 5,
	} as ServerConfig,

	requiredAndOptionalNoOptional: {
		apiKey: "test-api-key",
		endpoint: "https://test.example.com",
	} as ServerConfig,

	missingEndpoint: {
		apiKey: "test-api-key",
	} as ServerConfig,
}

export const savedConfigs = {
	requiredAndOptional: {
		apiKey: "saved-api-key",
		endpoint: "https://saved.example.com",
		debugMode: true,
		maxRetries: 5,
	} as ServerConfig,

	requiredAndOptionalPartial: {
		apiKey: "saved-api-key",
	} as ServerConfig | null,
}
