export const bundleDir = "/path/to/bundle"

export const bundleCommandWithDirname = {
	command: "node",
	// biome-ignore lint/suspicious/noTemplateCurlyInString: Literal template string for testing
	args: ["${__dirname}/bin"],
	env: undefined,
}

export const bundleCommandWithUserConfig = {
	command: "node",
	args: [],
	env: {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: Literal template string for testing
		API_KEY: "${user_config.apiKey}",
	},
}

export const bundleCommandWithBothTemplates = {
	command: "node",
	// biome-ignore lint/suspicious/noTemplateCurlyInString: Literal template strings for testing
	args: ["${__dirname}/server.js", "--api-key=${user_config.apiKey}"],
	env: {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: Literal template strings for testing
		API_KEY: "${user_config.apiKey}",
		// biome-ignore lint/suspicious/noTemplateCurlyInString: Literal template string for testing
		DATABASE_URL: "${user_config.database.host}:${user_config.database.port}",
	},
}

export const bundleCommandWithoutEnv = {
	command: "node",
	// biome-ignore lint/suspicious/noTemplateCurlyInString: Literal template string for testing
	args: ["${__dirname}/server.js"],
	env: undefined,
}

export const bundleCommandWithMissingConfig = {
	command: "node",
	args: [],
	env: {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: Literal template string for testing
		MISSING: "${user_config.missing}",
	},
}

export const bundleCommandWithPlainStrings = {
	command: "node",
	args: ["server.js", "--port=3000"],
	env: {
		NODE_ENV: "production",
		PORT: "3000",
	},
}

export const bundleCommandWithNestedConfig = {
	command: "node",
	args: [],
	env: {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: Literal template string for testing
		DB_HOST: "${user_config.db.host}",
	},
}

export const userConfigSimple = {
	apiKey: "sk-123",
}

export const userConfigNested = {
	db: {
		host: "localhost",
	},
	database: {
		host: "localhost",
		port: 5432,
	},
}

export const userConfigEmpty = {}
