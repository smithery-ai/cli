import type { z } from "zod"
import type { Server } from "@modelcontextprotocol/sdk/server/index.js"
import {
	ListToolsRequestSchema,
	CallToolRequestSchema,
	ListResourcesRequestSchema,
	ReadResourceRequestSchema,
	ListResourceTemplatesRequestSchema,
	ListPromptsRequestSchema,
	GetPromptRequestSchema,
	ListToolsResultSchema,
	CompatibilityCallToolResultSchema,
	ListResourcesResultSchema,
	ReadResourceResultSchema,
	ListResourceTemplatesResultSchema,
	ListPromptsResultSchema,
	GetPromptResultSchema,
	type ServerCapabilities,
	type ClientRequest,
} from "@modelcontextprotocol/sdk/types.js"

export interface ServerContext {
	server: Server;
	makeRequest: <T extends z.ZodType>(request: ClientRequest, schema: T) => Promise<z.infer<T>>;
	isReconnecting: boolean;
}

// bridge between MCP serer (remote / STDIO child) and our proxy
// server that communicates with client
export class HandlerManager {
	constructor(private context: ServerContext) {}

	async setupHandlers(Capabilities: ServerCapabilities): Promise<void> {
		console.error(
			"[Gateway] Setting up handlers for remote capabilities:",
			Capabilities,
		)

		if (Capabilities.tools) {
			this.setupToolHandlers()
		}
		if (Capabilities.resources) {
			this.setupResourceHandlers()
		}
		if (Capabilities.prompts) {
			this.setupPromptHandlers()
		}

		console.error("[Gateway] Handlers setup complete")
	}

	private setupToolHandlers(): void {
		this.context.server.setRequestHandler(ListToolsRequestSchema, async (request) => {
			console.error(
				"[Gateway] ListTools request:",
				JSON.stringify(request, null, 2),
			)
			const response = await this.context.makeRequest(
				{ method: "tools/list" as const, params: {} },
				ListToolsResultSchema,
			)
			return response
		})

		this.context.server.setRequestHandler(CallToolRequestSchema, async (request) => {
			console.error(
				"[Gateway] CallTool request:",
				JSON.stringify(request, null, 2),
			)
			try {
				const response = await this.context.makeRequest(
					{
						method: "tools/call" as const,
						params: request.params,
					},
					CompatibilityCallToolResultSchema,
				)
				console.error(
					"[Gateway] CallTool response:",
					JSON.stringify(response, null, 2),
				)
				return response
			} catch (error) {
				console.error("[Gateway] CallTool error:", error)
				throw error
			}
		})
	}

	private setupResourceHandlers(): void {
		this.context.server.setRequestHandler(
			ListResourcesRequestSchema,
			async (request) => {
				if (this.context.isReconnecting) {
					return {
						resources: [ // send empty response during reconnection
							{}
						]
					}
				}

				console.error(
					"[Gateway] ListResources request:",
					JSON.stringify(request, null, 2),
				)
				const response = await this.context.makeRequest(
					{ method: "resources/list" as const, params: {} },
					ListResourcesResultSchema,
				)
				return response
			},
		)

		this.context.server.setRequestHandler(
			ReadResourceRequestSchema,
			async (request) => {
				console.error(
					"[Gateway] ReadResource request:",
					JSON.stringify(request, null, 2),
				)
				try {
					const response = await this.context.makeRequest(
						{
							method: "resources/read" as const,
							params: request.params,
						},
						ReadResourceResultSchema,
					)
					return response
				} catch (error) {
					console.error("[Gateway] ReadResource error:", error)
					throw error
				}
			},
		)

		this.context.server.setRequestHandler(
			ListResourceTemplatesRequestSchema,
			async (request) => {
				console.error(
					"[Gateway] ListResourceTemplates request:",
					JSON.stringify(request, null, 2),
				)
				const response = await this.context.makeRequest(
					{ method: "resources/templates/list" as const, params: {} },
					ListResourceTemplatesResultSchema,
				)
				return response
			},
		)
	}

	private setupPromptHandlers(): void {
		this.context.server.setRequestHandler(ListPromptsRequestSchema, async (request) => {
			console.error(
				"[Gateway] ListPrompts request:",
				JSON.stringify(request, null, 2),
			)
			const response = await this.context.makeRequest(
				{ method: "prompts/list" as const, params: {} },
				ListPromptsResultSchema,
			)
			return response
		})

		this.context.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
			console.error(
				"[Gateway] GetPrompt request:",
				JSON.stringify(request, null, 2),
			)
			try {
				const response = await this.context.makeRequest(
					{
						method: "prompts/get" as const,
						params: request.params,
					},
					GetPromptResultSchema,
				)
				return response
			} catch (error) {
				console.error("[Gateway] GetPrompt error:", error)
				throw error
			}
		})
	}
}
