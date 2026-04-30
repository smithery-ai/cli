import { execSync, spawn } from "node:child_process"
import {
	closeSync,
	existsSync,
	openSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import pc from "picocolors"

const HOMEPAGE_DIR = join(homedir(), ".smithery", "homepage")
const PID_FILE = join(homedir(), ".smithery", "homepage.pid")
const LOG_FILE = join(homedir(), ".smithery", "homepage.log")

function runSync(cmd: string, cwd?: string) {
	execSync(cmd, { cwd, stdio: "inherit" })
}

function ensurePortless() {
	try {
		execSync("portless --version", { stdio: "ignore" })
	} catch {
		console.log(pc.cyan("Installing portless..."))
		runSync("npm install -g portless")
	}
}

function validateProject(): { ok: boolean } {
	if (!existsSync(HOMEPAGE_DIR)) {
		console.error(pc.red("No homepage project found at ~/.smithery/homepage"))
		console.log()
		console.log("Create one with:")
		console.log(
			pc.cyan(
				"  cd /tmp && npx shadcn@latest init --preset b1FSjVe3E --template start --name smithery-homepage",
			),
		)
		console.log(
			pc.cyan(
				"  mkdir -p ~/.smithery && mv /tmp/smithery-homepage ~/.smithery/homepage",
			),
		)
		console.log()
		console.log("Then install dependencies and configure Vite:")
		console.log(pc.cyan("  cd ~/.smithery/homepage && npm install"))
		console.log()
		console.log(
			pc.dim(
				'Add to vite.config.ts: server: { host: process.env.HOST || "127.0.0.1" }',
			),
		)
		return { ok: false }
	}

	const issues: string[] = []

	if (!existsSync(join(HOMEPAGE_DIR, "package.json"))) {
		issues.push("Missing package.json")
	} else {
		try {
			const pkg = JSON.parse(
				readFileSync(join(HOMEPAGE_DIR, "package.json"), "utf-8"),
			)
			if (!pkg.scripts?.dev) {
				issues.push(
					'No "dev" script in package.json — add one (e.g. "dev": "vite dev")',
				)
			}
		} catch {
			issues.push("package.json is not valid JSON")
		}
	}

	const hasViteConfig =
		existsSync(join(HOMEPAGE_DIR, "vite.config.ts")) ||
		existsSync(join(HOMEPAGE_DIR, "vite.config.js"))
	if (!hasViteConfig) {
		issues.push("Missing vite.config.ts — this should be a Vite-based project")
	} else {
		const configPath = existsSync(join(HOMEPAGE_DIR, "vite.config.ts"))
			? join(HOMEPAGE_DIR, "vite.config.ts")
			: join(HOMEPAGE_DIR, "vite.config.js")
		try {
			const config = readFileSync(configPath, "utf-8")
			if (!config.includes("process.env.HOST")) {
				issues.push(
					'vite.config.ts is missing server.host — add: server: { host: process.env.HOST || "127.0.0.1" }',
				)
			}
		} catch {}
	}

	if (issues.length > 0) {
		console.error(
			pc.red("Homepage project at ~/.smithery/homepage has issues:"),
		)
		for (const issue of issues) {
			console.error(pc.yellow(`  • ${issue}`))
		}
		return { ok: false }
	}

	return { ok: true }
}

function readPid(): number | null {
	try {
		const pid = Number.parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10)
		return Number.isNaN(pid) ? null : pid
	} catch {
		return null
	}
}

function isProcessRunning(pid: number): boolean {
	try {
		process.kill(pid, 0)
		return true
	} catch {
		return false
	}
}

function getDaemonStatus(): { running: boolean; pid: number | null } {
	const pid = readPid()
	if (pid === null) return { running: false, pid: null }
	if (isProcessRunning(pid)) return { running: true, pid }
	// Stale pid file
	try {
		unlinkSync(PID_FILE)
	} catch {}
	return { running: false, pid: null }
}

function ensureProject(): boolean {
	const { ok } = validateProject()
	if (!ok) return false
	if (!existsSync(join(HOMEPAGE_DIR, "node_modules"))) {
		console.log(pc.cyan("Installing dependencies..."))
		runSync("npm install", HOMEPAGE_DIR)
	}
	return true
}

function detectPort(): number | null {
	try {
		const log = readFileSync(LOG_FILE, "utf-8")
		const matches = [...log.matchAll(/Using port (\d+)/g)]
		if (matches.length === 0) return null
		return Number.parseInt(matches[matches.length - 1][1], 10)
	} catch {
		return null
	}
}

async function waitForReady(pid: number, timeoutMs = 10000): Promise<boolean> {
	const start = Date.now()
	while (Date.now() - start < timeoutMs) {
		if (!isProcessRunning(pid)) return false
		const port = detectPort()
		if (port) {
			try {
				const res = await fetch(`http://127.0.0.1:${port}`, {
					signal: AbortSignal.timeout(2000),
				})
				if (res.ok) return true
			} catch {}
		}
		await new Promise((r) => setTimeout(r, 500))
	}
	return false
}

function printUrl() {
	const port = detectPort()
	console.log(pc.cyan("Visit https://smithery.localhost"))
	if (port) {
		console.log(pc.dim(`      http://localhost:${port}`))
	}
}

export async function homepageUp() {
	const { running, pid } = getDaemonStatus()
	if (running) {
		console.log(pc.green(`Homepage is already running (pid ${pid}).`))
		printUrl()
		return
	}

	if (!ensureProject()) {
		process.exit(1)
	}
	ensurePortless()

	const logFd = openSync(LOG_FILE, "w")
	const child = spawn("portless", ["smithery", "npm", "run", "dev"], {
		cwd: HOMEPAGE_DIR,
		stdio: ["ignore", logFd, logFd],
		detached: true,
	})

	child.unref()
	closeSync(logFd)

	writeFileSync(PID_FILE, String(child.pid))
	console.log(pc.green(`Homepage started (pid ${child.pid})`))

	const ready = await waitForReady(child.pid!)
	if (ready) {
		printUrl()
	} else {
		console.log(pc.yellow("Dev server is still starting..."))
		printUrl()
	}
	console.log(pc.dim(`Logs: ~/.smithery/homepage.log`))
}

export function homepageDown() {
	const { running, pid } = getDaemonStatus()
	if (!running || pid === null) {
		console.log(pc.yellow("Homepage is not running."))
		return
	}

	try {
		// Kill the process group (negative pid) so child processes also stop
		process.kill(-pid, "SIGTERM")
	} catch {
		try {
			process.kill(pid, "SIGTERM")
		} catch {}
	}

	try {
		unlinkSync(PID_FILE)
	} catch {}

	console.log(pc.green(`Homepage stopped (pid ${pid}).`))
}

export function homepageStatus() {
	const { running, pid } = getDaemonStatus()
	if (running) {
		console.log(pc.green(`Homepage is running (pid ${pid}).`))
		printUrl()
	} else {
		console.log(pc.yellow("Homepage is not running."))
		console.log(pc.dim("Run 'smithery homepage up' to start it."))
	}
}
