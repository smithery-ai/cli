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

export class HandlerManager {
	constructor(
		private server: Server,
		private makeRequest: <T extends z.ZodType>(
			request: ClientRequest,
			schema: T,
		) => Promise<z.infer<T>>,
	) {}

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
		this.server.setRequestHandler(ListToolsRequestSchema, async (request) => {
			console.error(
				"[Gateway] ListTools request:",
				JSON.stringify(request, null, 2),
			)
			const response = await this.makeRequest(
				{ method: "tools/list" as const, params: {} },
				ListToolsResultSchema,
			)
			return response
		})

		this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
			console.error(
				"[Gateway] CallTool request:",
				JSON.stringify(request, null, 2),
			)
			try {
				const response = await this.makeRequest(
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
		this.server.setRequestHandler(
			ListResourcesRequestSchema,
			async (request) => {
				console.error(
					"[Gateway] ListResources request:",
					JSON.stringify(request, null, 2),
				)
				const response = await this.makeRequest(
					{ method: "resources/list" as const, params: {} },
					ListResourcesResultSchema,
				)
				return response
			},
		)

		this.server.setRequestHandler(
			ReadResourceRequestSchema,
			async (request) => {
				console.error(
					"[Gateway] ReadResource request:",
					JSON.stringify(request, null, 2),
				)
				try {
					const response = await this.makeRequest(
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

		this.server.setRequestHandler(
			ListResourceTemplatesRequestSchema,
			async (request) => {
				console.error(
					"[Gateway] ListResourceTemplates request:",
					JSON.stringify(request, null, 2),
				)
				const response = await this.makeRequest(
					{ method: "resources/templates/list" as const, params: {} },
					ListResourceTemplatesResultSchema,
				)
				return response
			},
		)
	}

	private setupPromptHandlers(): void {
		this.server.setRequestHandler(ListPromptsRequestSchema, async (request) => {
			console.error(
				"[Gateway] ListPrompts request:",
				JSON.stringify(request, null, 2),
			)
			const response = await this.makeRequest(
				{ method: "prompts/list" as const, params: {} },
				ListPromptsResultSchema,
			)
			return response
		})

		this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
			console.error(
				"[Gateway] GetPrompt request:",
				JSON.stringify(request, null, 2),
			)
			try {
				const response = await this.makeRequest(
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
