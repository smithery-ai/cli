import { EventSource } from "eventsource";
import { createSmitheryUrl } from "@smithery/sdk/config.js";

export class SSERunner {
    private sessionId: string | null = null;
    private eventSource: EventSource | null = null;
    private isReady: boolean = false;
    private messageQueue: Buffer[] = [];
    private reconnectAttempts: number = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 3;
    private readonly RECONNECT_DELAY = 1000; // 1 second
    private lastParsedMessage: any = null;

    constructor(
        private baseUrl: string,
        private config: Record<string, unknown>
    ) {}

    async connect(): Promise<void> {
        if (this.eventSource) {
            console.error("Closing existing EventSource connection");
            this.eventSource.close();
        }

        const sseUrl = new URL("/sse", this.baseUrl).toString();
        const connectionUrl = createSmitheryUrl(sseUrl, this.config);

        console.error(`Connecting to SSE endpoint: ${connectionUrl}`);

        return new Promise((resolve, reject) => {
            this.eventSource = new EventSource(connectionUrl);

            this.eventSource.onopen = () => {
                const timestamp = new Date().toISOString();
                console.error(`SSE connection established at ${timestamp}`);
                this.reconnectAttempts = 0;
                resolve();
            };

            this.eventSource.onerror = (error) => {
                console.error(`SSE connection error: ${(error as any)?.message}`);
                this.handleConnectionError(error);
                reject(error);
            };

            // Set up event listeners
            this.eventSource.addEventListener("endpoint", (event) => {
                const match = event.data.match(/sessionId=([^&]+)/);
                if (match) {
                    this.sessionId = match[1];
                    this.isReady = true;
                    console.error(`Session established: ${this.sessionId}`);
                    this.processQueuedMessages();
                }
            });

            this.eventSource.addEventListener("message", (event) => {
                try {
                    const parsed = JSON.parse(event.data);
                    this.lastParsedMessage = parsed;
                    console.log(event.data); // Send to stdout for consumption
                } catch (error) {
                    console.error(`Error parsing message: ${error}`);
                    console.error(`Raw message data: ${event.data}`);
                    console.log(event.data); // Still send to stdout even if parse fails
                }
            });

            this.eventSource.addEventListener("reconnect", () => {
                this.reconnect();
            });
        });
    }

    private handleConnectionError(error: any): void {
        console.error(`Connection error details: ${JSON.stringify(error, null, 2)}`);
        if (this.eventSource?.readyState === EventSource.CLOSED) {
            console.error("EventSource connection closed");
            this.reconnect();
        }
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
        if (!this.isReady || !this.sessionId) {
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
                const url = new URL("/message", this.baseUrl);
                url.searchParams.set("sessionId", this.sessionId);
                
                // Validate each individual message is valid JSON before sending
                JSON.parse(msgStr); // This will throw if invalid

                const response = await fetch(url.toString(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: msgStr
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`Error from server: ${response.status} ${response.statusText}`);
                    console.error(`Error details: ${errorText}`);
                    
                    if (response.status === 503) {
                        console.error("Service unavailable - attempting reconnect");
                        this.reconnect();
                    }
                }
            } catch (error) {
                console.error(`Request error: ${error}`);
            }
        }
    }

    private async processQueuedMessages(): Promise<void> {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message) {
                await this.processMessage(message);
            }
        }
    }

    cleanup(): void {
        console.error("Starting cleanup...");
        if (this.eventSource) {
            this.eventSource.close();
        }
        console.error("Cleanup completed");
    }
}

// Main entry point
export async function createSSERunner(
    baseUrl: string,
    config: Record<string, unknown>
) {
    const runner = new SSERunner(baseUrl, config);
    await runner.connect();
    return runner;
} 