import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js"
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js"
import { createSmitheryUrl } from "@smithery/sdk/config.js"

interface LazyConnectionOptions {
  idleTimeout: number
  maxBuffer: number
}

const DEFAULT_OPTIONS: LazyConnectionOptions = {
  idleTimeout: 60 * 1000, // 1 minute
  maxBuffer: 100, 
}

export class ProxyTransport implements Transport {
  private realTransport: WebSocketClientTransport | null = null
  private messageBuffer: JSONRPCMessage[] = []
  private idleTimer: NodeJS.Timeout | null = null
  private isConnecting: boolean = false
  private connectionPromise: Promise<void> | null = null

  constructor(
    private baseUrl: string,
    private config: Record<string, unknown>,
    private options: LazyConnectionOptions = DEFAULT_OPTIONS
  ) {}

  private resetIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
    }
    this.idleTimer = setTimeout(() => this.disconnect(), this.options.idleTimeout)
  }

  private async ensureConnected(): Promise<void> {
    if (this.realTransport) {
      this.resetIdleTimer()
      return
    }

    if (this.connectionPromise) {
      return this.connectionPromise
    }

    this.isConnecting = true
    this.connectionPromise = (async () => {
      const wsUrl = `${this.baseUrl.replace(/^http/, "ws")}${
        this.baseUrl.endsWith("/") ? "" : "/"
      }ws`
      const url = createSmitheryUrl(wsUrl, this.config)
      
      console.error("ProxyTransport: Creating new WebSocket connection...")
      const transport = new WebSocketClientTransport(url)

      // Forward callbacks
      transport.onmessage = (msg) => this.onmessage?.(msg)
      transport.onerror = (err) => this.onerror?.(err)
      transport.onclose = () => {
        this.realTransport = null
        // Don't forward onclose since proxy remains active
      }

      await transport.start()
      this.realTransport = transport
      this.resetIdleTimer()

      console.error("ProxyTransport: Connection established, processing buffer...")
      // Process buffered messages
      while (this.messageBuffer.length > 0) {
        const msg = this.messageBuffer.shift()!
        await this.realTransport.send(msg)
      }
    })()

    try {
      await this.connectionPromise
    } finally {
      this.isConnecting = false
      this.connectionPromise = null
    }
  }

  private async disconnect() {
    if (this.realTransport) {
      console.error("ProxyTransport: Closing idle connection")
      await this.realTransport.close()
      this.realTransport = null
    }
  }

  async start(): Promise<void> {
    // Don't actually connect - wait for first message
    return
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.realTransport && !this.isConnecting) {
      if (this.messageBuffer.length >= this.options.maxBuffer) {
        throw new Error("Message buffer full")
      }
      this.messageBuffer.push(message)
      await this.ensureConnected()
    } else if (this.isConnecting) {
      this.messageBuffer.push(message)
    } else {
      await this.realTransport!.send(message)
      this.resetIdleTimer()
    }
  }

  async close(): Promise<void> {
    await this.disconnect()
    if (this.onclose) {
      this.onclose()
    }
  }

  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage) => void
} 