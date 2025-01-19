#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import {
  ClientRequest,
  ServerCapabilities,
} from '@modelcontextprotocol/sdk/types.js'
import { EventSource } from "eventsource"
import { z } from 'zod'
import { HandlerManager } from '../utils/mcp-handlers.js'
global.EventSource = EventSource as any

// Modified to remove client parameter
export async function run(serverId: string) {
    // For now using dummy URL - will be replaced with registry lookup
    const sseUrl = `https://ddc7b706-b403-4217-8df7-dd7a065eae4d-5u5fdnfupa-uc.a.run.app/sse`
    const config = {} // Placeholder empty config
    
    const server = new GatewayServer()
    try {
        await server.run(sseUrl)
    } catch (error) {
        console.error('[Gateway] Fatal error:', error)
        process.exit(1)
    }
}

class GatewayServer {
  private server!: Server
  private sseClient: Client
  private handlerManager!: HandlerManager
  private closing = false
  private requestTimeout = 10000 // 10 seconds default timeout
  
  constructor() {
    this.closing = false
    
    this.sseClient = new Client(
      { name: 'smithery-runner', version: '1.0.0' },
      { capabilities: {} }
    )
  }

  private async makeRequest<T extends z.ZodType>(request: ClientRequest, schema: T) {
    if (!this.sseClient) {
      throw new Error("Client not connected");
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort("Request timed out");
    }, this.requestTimeout);

    try {
      const response = await this.sseClient.request(request, schema, {
        signal: abortController.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async setupHandlers(remoteCapabilities: ServerCapabilities): Promise<void> {
    this.handlerManager = new HandlerManager(
      this.server,
      this.sseClient,
      this.makeRequest.bind(this)
    )
    await this.handlerManager.setupHandlers(remoteCapabilities)
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[Gateway] Server error:', error)
      if (!this.closing) {
        this.cleanup().catch(err => {
          console.error('[Gateway] Cleanup error during error handling:', err)
        })
      }
    }

    this.sseClient.onerror = (error) => {
      console.error('[Gateway] SSE client error:', error)
      if (!this.closing) {
        this.cleanup().catch(err => {
          console.error('[Gateway] Cleanup error during error handling:', err)
        })
      }
    }

    this.server.onclose = () => {
      console.error('[Gateway] Server closed')
      if (!this.closing) {
        this.cleanup().catch(err => {
          console.error('[Gateway] Cleanup error during close:', err)
        })
      }
    }

    this.sseClient.onclose = () => {
      console.error('[Gateway] SSE client closed')
      if (!this.closing) {
        this.cleanup().catch(err => {
          console.error('[Gateway] Cleanup error during close:', err)
        })
      }
    }

    process.on('SIGINT', () => this.cleanup())
    process.on('SIGTERM', () => this.cleanup())
  }

  private async cleanup(): Promise<void> {
    if (this.closing) {
      return
    }

    this.closing = true
    console.error('[Gateway] Starting cleanup...')

    try {
      if (this.sseClient) {
        console.error('[Gateway] Closing SSE client...')
        await this.sseClient.close()
      }

      if (this.server) {
        console.error('[Gateway] Closing server...')
        await this.server.close()
      }

      console.error('[Gateway] Cleanup completed')
      process.exit(0)
    } catch (error) {
      console.error('[Gateway] Fatal error during cleanup:', error)
      process.exit(1)
    }
  }

  async run(sseUrl: string): Promise<void> {
    try {
      // Connect SSE client first to discover capabilities
      const sseTransport = new SSEClientTransport(new URL(sseUrl))
      await this.sseClient.connect(sseTransport)
      console.error('[Gateway] Connected to remote SSE server')

      // Get capabilities
      const capabilities = this.sseClient.getServerCapabilities() || {}
      console.error('[Gateway] Remote server capabilities:', capabilities)

      // Create server with the discovered capabilities
      this.server = new Server(
        { name: 'smithery-runner', version: '1.0.0' },
        { capabilities }
      )

      // Set up error handling
      this.setupErrorHandling()

      // Set up handlers based on remote capabilities
      await this.setupHandlers(capabilities)

      // Finally connect local STDIO server
      const stdioTransport = new StdioServerTransport()
      await this.server.connect(stdioTransport)
      console.error('[Gateway] STDIO server ready')

    } catch (error) {
      console.error('[Gateway] Setup error:', error)
      await this.cleanup()
      throw error
    }
  }
}