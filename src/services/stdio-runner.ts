import type { ResolvedServer } from "../types/registry.js"
import { collectConfigValues } from "../utils/runtime-utils.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js"
import { getServerConfiguration } from "../utils/registry-utils.js"
import { ANALYTICS_ENDPOINT } from "../constants.js"
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { pick } from "lodash"

type Config = Record<string, unknown>
type Cleanup = () => Promise<void>

export const createStdioRunner = async (
    serverDetails: ResolvedServer,
    config: Config,
    userId?: string
): Promise<Cleanup> => {
    let stdinBuffer = ""
    let isReady = false
    let transport: StdioClientTransport | null = null

    const handleError = (error: Error, context: string) => {
        console.error(`[Runner] ${context}:`, error.message)
        return error
    }

    const processMessage = async (data: Buffer) => {
        stdinBuffer += data.toString("utf8")

        if (!isReady) return // Wait for connection to be established

        const lines = stdinBuffer.split(/\r?\n/)
        stdinBuffer = lines.pop() ?? ""

        for (const line of lines.filter(Boolean)) {
            try {
                const message = JSON.parse(line)
                
                // Track tool usage if user consent is given
                if (userId && ANALYTICS_ENDPOINT) {
                    const { data: toolData, error } = CallToolRequestSchema.safeParse(message)
                    if (!error) {
                        // Fire and forget analytics
                        fetch(ANALYTICS_ENDPOINT, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                eventName: "tool_call",
                                payload: {
                                    connectionType: "stdio",
                                    serverQualifiedName: serverDetails.qualifiedName,
                                    toolParams: pick(toolData.params, "name"),
                                },
                            }),
                        }).catch(err => {
                            console.error("[Runner] Analytics error:", err)
                        })
                    }
                }

                await transport?.send(message)
            } catch (error) {
                handleError(error as Error, "Failed to send message to child process")
            }
        }
    }

    const setupTransport = async () => {
        console.error("[Runner] Starting child process setup...")
        const stdioConnection = serverDetails.connections.find(
            conn => conn.type === "stdio"
        )
        if (!stdioConnection) {
            throw new Error("No STDIO connection found")
        }

        // Process config values and fetch server configuration
        const processedConfig = await collectConfigValues(stdioConnection, config)
        const serverConfig = await getServerConfiguration(
            serverDetails.qualifiedName,
            processedConfig,
            "stdio"
        )

        if (!serverConfig || 'type' in serverConfig) {
            throw new Error("Failed to get valid stdio server configuration")
        }

        const { command, args = [], env = {} } = serverConfig

        transport = new StdioClientTransport({
            command: command,
            args: args,
            env: { ...getDefaultEnvironment(), ...env }
        })

        transport.onmessage = (message) => {
            try {
                if ("error" in message) {
                    // Skip logging "Method not found" errors, let the client handle this
                    if (message.error?.code !== -32601) {
                        console.error(`[Runner] Child process error:`, message.error)
                    }
                }
                // Forward the message to stdout
                console.log(JSON.stringify(message))
            } catch (error) {
                handleError(error as Error, "Error handling message")
            }
        }

        transport.onclose = () => {
            console.error('[Runner] Child process terminated')
            // If the process died unexpectedly, we should exit with an error
            if (isReady) {
                console.error('[Runner] Process terminated unexpectedly while running')
                process.exit(1)
            }
            process.exit(0)
        }

        transport.onerror = err => {
            console.error('[Runner] Child process error:', err.message)
            if (err.message.includes('spawn')) {
                console.error('[Runner] Failed to spawn child process - check if the command exists and is executable')
            } else if (err.message.includes('permission')) {
                console.error('[Runner] Permission error when running child process')
            }
            process.exit(1)
        }

        await transport.start()
        isReady = true
        // Process any buffered messages
        await processMessage(Buffer.from(""))
    }

    const cleanup = async () => {
        console.error("[Runner] Starting cleanup...")
        if (transport) {
            await transport.close()
            transport = null
        }
        console.error("[Runner] Cleanup completed")
    }

    const handleExit = async () => {
        console.error("[Runner] Shutting down STDIO Runner...")
        await cleanup()
        process.exit(0)
    }

    // Setup event handlers
    process.on("SIGINT", handleExit)
    process.on("SIGTERM", handleExit)
    process.stdin.on("data", (data) =>
        processMessage(data).catch((error) =>
            handleError(error, "Error processing message")
        )
    )

    // Start the transport
    await setupTransport()

    return cleanup
} 