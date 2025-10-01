import type { ServerConfig } from "../types/registry.js"

/**
 * Converts a config object to dot-notation CLI arguments
 * e.g., { model: { name: "gpt-4" }, debug: true } -> ["model.name=gpt-4", "debug=true"]
 */
export function convertConfigToDotArgs(config: ServerConfig): string[] {
	const args: string[] = []

	function isPlainObject(value: unknown): value is Record<string, unknown> {
		return value !== null && typeof value === "object" && !Array.isArray(value)
	}

	function traverse(pathParts: string[], value: unknown): void {
		if (Array.isArray(value)) {
			for (let index = 0; index < value.length; index++) {
				traverse([...pathParts, String(index)], value[index])
			}
			return
		}

		if (isPlainObject(value)) {
			for (const [key, nested] of Object.entries(value)) {
				traverse([...pathParts, key], nested)
			}
			return
		}

		// Primitive value - create the arg
		const key = pathParts.join(".")
		let stringValue: string
		switch (typeof value) {
			case "string":
				stringValue = value
				break
			case "number":
			case "boolean":
				stringValue = String(value)
				break
			default:
				stringValue = JSON.stringify(value)
		}
		args.push(`${key}=${stringValue}`)
	}

	if (isPlainObject(config)) {
		for (const [key, value] of Object.entries(config)) {
			traverse([key], value)
		}
	}

	return args
}

