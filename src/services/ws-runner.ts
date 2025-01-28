import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import { createSmitheryUrl } from "@smithery/sdk/config.js";

export class WSRunner {
    private transport: WebSocketClientTransport | null = null;
    private isReady: boolean = false;
    private messageQueue: Buffer[] = [];
    private reconnectAttempts: number = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 3;
    private readonly RECONNECT_DELAY = 1000; // 1 second
    private lastParsedMessage: any = null;

    constructor(
        private baseUrl: string,
        private config: Record<string, unknown>
    ) { }

    async connect(): Promise<void> {
        if (this.transport) {
            console.error("Closing existing WebSocket connection");
            await this.transport.close();
        }

        // Convert http(s):// to ws(s)://
        // const wsBaseUrl = this.baseUrl.replace(/^http/, 'ws');
        // const wsUrl = new URL("/ws", wsBaseUrl).toString();
        const wsUrl = 'ws://localhost:8080/ws'
        const connectionUrl = createSmitheryUrl(wsUrl, this.config);

        console.error(`Connecting to WebSocket endpoint: ${connectionUrl}`);

        this.transport = new WebSocketClientTransport(connectionUrl);

        this.transport.onclose = () => {
            console.error("WebSocket connection closed");
            this.isReady = false;
            this.handleConnectionClosed();
        };

        this.transport.onerror = (error) => {
            console.error(`WebSocket connection error: ${error.message}`);
            this.handleConnectionError(error);
        };

        this.transport.onmessage = (message) => {
            try {
                this.lastParsedMessage = message;
                console.log(JSON.stringify(message)); // Send to stdout for consumption
            } catch (error) {
                console.error(`Error handling message: ${error}`);
                console.error(`Raw message data: ${JSON.stringify(message)}`);
                console.log(JSON.stringify(message)); // Still send to stdout even if handling fails
            }
        };

        // Start the transport
        await this.transport.start()
        this.isReady = true;
        this.processQueuedMessages();
    }

    private async processQueuedMessages(): Promise<void> {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message) {
                await this.processMessage(message);
            }
        }
    }
    private handleConnectionError(error: Error): void {
        console.error(`Connection error details: ${error.message}`);
        this.reconnect();
    }

    private handleConnectionClosed(): void {
        console.error("Connection closed, attempting reconnect");
        this.reconnect();
    }

    private async reconnect(): Promise<void> {
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            console.error(`Max reconnection attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached, exiting...`);
            console.error(`Last parsed message: ${JSON.stringify(this.lastParsedMessage, null, 2)}`);
            process.exit(1);
            return;
        }

        this.reconnectAttempts++;
        this.isReady = false;

        try {
            await new Promise(resolve => setTimeout(resolve, this.RECONNECT_DELAY));
            await this.connect();
        } catch (error) {
            console.error(`Reconnection failed: ${error}`);
            console.error(`Last parsed message before failure: ${JSON.stringify(this.lastParsedMessage, null, 2)}`);
        }
    }

    async processMessage(input: Buffer): Promise<void> {
        if (!this.isReady || !this.transport) {
            this.messageQueue.push(input);
            return;
        }

        const message = input.toString();
        try {
            // Try to parse the entire message first
            JSON.parse(message);
        } catch (error) {
            // If parsing fails, it might be multiple JSON objects
            console.error(`Note: Message contains multiple JSON objects or is malformed`);
        }

        // Split by newlines and process each message separately
        const messages = message
            .split('\n')
            .filter(msg => msg.trim())
            .map(msg => msg.trim());

        for (const msgStr of messages) {
            try {
                // Validate each individual message is valid JSON before sending
                const jsonMessage = JSON.parse(msgStr);

                await this.transport.send(jsonMessage);
            } catch (error) {
                console.error(`Failed to send message: ${error}`);
                if (error instanceof Error && error.message.includes('CLOSED')) {
                    console.error("WebSocket closed - attempting reconnect");
                    this.reconnect();
                    break;
                }
            }
        }
    }

    cleanup(): void {
        console.error("Starting cleanup...");
        if (this.transport) {
            this.transport.close().catch(error => {
                console.error(`Error during cleanup: ${error}`);
            });
        }
        console.error("Cleanup completed");
    }
}