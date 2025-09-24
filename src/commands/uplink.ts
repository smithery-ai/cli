import { type ChildProcess, spawn, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import chalk from "chalk"
import { DEFAULT_PORT } from "../constants"
import { buildServer } from "../lib/build"
import { setupTunnelAndPlayground } from "../lib/dev-lifecycle"
import { debug } from "../lib/logger"
import { cleanupChildProcess } from "../utils/child-process-cleanup"
import { setupProcessLifecycle } from "../utils/process-lifecycle"
import { ensureApiKey } from "../utils/runtime"

interface UplinkOptions {
	entryFile?: string
	port?: string
	key?: string
	open?: boolean
	initialMessage?: string
}

function createScaffoldServer(): string {
	return `import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "uplink-scaffold",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "example_tool",
        description: "An example tool that echoes back the input",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Message to echo back",
            },
          },
          required: ["message"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "example_tool") {
    const message = args?.message as string;
    return {
      content: [
        {
          type: "text",
          text: \`Echo: \${message}\`,
        },
      ],
    };
  }

  throw new Error(\`Unknown tool: \${name}\`);
});

export default server;
`
}

export async function uplink(options: UplinkOptions = {}): Promise<void> {
	try {
		// Ensure API key is available
		const apiKey = await ensureApiKey(options.key)

		const smitheryDir = join(".smithery")
		const outFile = join(smitheryDir, "index.cjs")
		const finalPort = options.port || DEFAULT_PORT.toString()

		// Create scaffold if no entry file is provided
		if (!options.entryFile) {
			// Create a temporary scaffold file
			const scaffoldDir = join(".smithery", "scaffold")
			const scaffoldFile = join(scaffoldDir, "index.ts")
			const packageJsonFile = join(scaffoldDir, "package.json")

			// Ensure directories exist
			if (!existsSync(smitheryDir)) {
				mkdirSync(smitheryDir, { recursive: true })
			}
			if (!existsSync(scaffoldDir)) {
				mkdirSync(scaffoldDir, { recursive: true })
			}

			// Create a package.json for the scaffold with necessary dependencies
			const scaffoldPackageJson = {
				name: "smithery-scaffold",
				version: "1.0.0",
				type: "module",
				dependencies: {
					"@modelcontextprotocol/sdk": "^1.10.1",
				},
			}
			writeFileSync(
				packageJsonFile,
				JSON.stringify(scaffoldPackageJson, null, 2),
			)

			// Write scaffold file
			writeFileSync(scaffoldFile, createScaffoldServer())
			options.entryFile = scaffoldFile

			console.log(
				chalk.cyan("📝 Created scaffold server at .smithery/scaffold/index.ts"),
			)

			// Install dependencies for the scaffold
			console.log(chalk.cyan("📦 Installing scaffold dependencies..."))
			const installResult = spawnSync("npm", ["install"], {
				cwd: scaffoldDir,
				stdio: "inherit",
			})

			if (installResult.status !== 0) {
				console.error(chalk.red("❌ Failed to install scaffold dependencies"))
				process.exit(1)
			}
		}

		let childProcess: ChildProcess | undefined
		let tunnelListener: { close: () => Promise<void> } | undefined
		let isFirstBuild = true
		let isRebuilding = false

		// Function to start the server process
		const startServer = async () => {
			// Kill existing process
			if (childProcess && !childProcess.killed) {
				isRebuilding = true
				childProcess.kill("SIGTERM")
				await new Promise((resolve) => setTimeout(resolve, 100))
			}

			// Ensure the output file exists before starting the process (handles async fs write timing)
			await new Promise<void>((resolve) => {
				if (existsSync(outFile)) {
					return resolve()
				}
				const interval = setInterval(() => {
					if (existsSync(outFile)) {
						clearInterval(interval)
						resolve()
					}
				}, 50)
			})

			// Start new process with tsx loader so .ts imports work in runtime bootstrap
			childProcess = spawn(
				"node",
				["--import", "tsx", join(process.cwd(), outFile)],
				{
					stdio: ["inherit", "pipe", "pipe"],
					env: {
						...process.env,
						PORT: finalPort,
					},
				},
			)

			const processOutput = (data: Buffer) => {
				const chunk = data.toString()
				process.stdout.write(chunk)
			}

			childProcess.stdout?.on("data", processOutput)
			childProcess.stderr?.on("data", (data) => {
				const chunk = data.toString()
				process.stderr.write(chunk)
			})

			childProcess.on("error", (error) => {
				console.error(chalk.red("❌ Process error:"), error)
				cleanup()
			})

			childProcess.on("exit", (code) => {
				// Ignore exits during rebuilds - this is expected behavior
				if (isRebuilding) {
					isRebuilding = false
					return
				}

				if (code !== 0 && code !== null) {
					console.log(chalk.yellow(`⚠️  Process exited with code ${code}`))
					cleanup()
				}
			})

			// Start tunnel and open playground on first successful start
			if (isFirstBuild) {
				console.log(
					chalk.green(`✅ Uplink server starting on port ${finalPort}`),
				)
				setupTunnelAndPlayground(
					finalPort,
					apiKey,
					options.open !== false,
					options.initialMessage,
				)
					.then(({ listener }) => {
						tunnelListener = listener
						isFirstBuild = false
					})
					.catch((error) => {
						console.error(chalk.red("❌ Failed to start tunnel:"), error)
					})
			}
		}

		// Set up build with watch mode
		const buildContext = await buildServer({
			outFile,
			entryFile: options.entryFile,
			watch: true,
			onRebuild: () => {
				startServer()
			},
		})

		// Handle cleanup on exit
		const cleanup = async () => {
			console.log(chalk.yellow("\n👋 Shutting down uplink server..."))

			// Stop watching
			if (buildContext && "dispose" in buildContext) {
				await buildContext.dispose()
			}

			// Kill child process
			if (childProcess) {
				await cleanupChildProcess({
					childProcess,
					processName: "server",
				})
			}

			// Close tunnel
			if (tunnelListener) {
				try {
					await tunnelListener.close()
					debug(chalk.green("Tunnel closed"))
				} catch (_error) {
					debug(chalk.yellow("Tunnel already closed"))
				}
			}
		}

		// Set up process lifecycle management
		setupProcessLifecycle({
			cleanupFn: cleanup,
			processName: "uplink server",
		})
	} catch (error) {
		console.error(chalk.red("❌ Uplink server failed:"), error)
		process.exit(1)
	}
}
