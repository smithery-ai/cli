import type {
	DeployPayload as ApiDeployPayload,
	HostedDeployPayload,
} from "@smithery/api/resources/servers/releases"

export type StdioDeployPayload = Omit<HostedDeployPayload, "type"> & {
	type: "stdio"
	runtime: "node"
}

export type DeployPayload = ApiDeployPayload | StdioDeployPayload
