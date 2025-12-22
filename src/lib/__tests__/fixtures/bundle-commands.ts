export const bundleDir = "/path/to/bundle"

export const bundleCommandWithDirname = {
	command: "node",
	args: ["${__dirname}/bin"],
	env: undefined,
}

export const bundleCommandWithUserConfig = {
	command: "node",
	args: [],
	env: {
		API_KEY: "${user_config.apiKey}",
	},
}

export const bundleCommandWithBothTemplates = {
	command: "node",
	args: ["${__dirname}/server.js", "--api-key=${user_config.apiKey}"],
	env: {
		API_KEY: "${user_config.apiKey}",
		DATABASE_URL: "${user_config.database.host}:${user_config.database.port}",
	},
}

export const bundleCommandWithoutEnv = {
	command: "node",
	args: ["${__dirname}/server.js"],
	env: undefined,
}

export const bundleCommandWithMissingConfig = {
	command: "node",
	args: [],
	env: {
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
