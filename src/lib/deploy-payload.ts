import type {
	DeployPayload as ApiDeployPayload,
	ServerCard,
} from "@smithery/api/resources/servers/releases"
import type { JSONSchema } from "../types/registry.js"

export type StdioDeployPayload = {
	type: "stdio"
	runtime: "node" | "binary" | "python" | "bun"
	configSchema?: JSONSchema
	serverCard?: ServerCard
}

export type DeployPayload = ApiDeployPayload | StdioDeployPayload
