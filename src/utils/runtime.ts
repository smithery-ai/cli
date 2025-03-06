import type { ConnectionDetails } from "../types/registry"
import inquirer from "inquirer"
import chalk from "chalk"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import { getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js"
import ora from "ora"
import { join } from "node:path"
import { promises as fs } from 'node:fs'
import { access } from 'fs/promises';

const execAsync = promisify(exec)

export async function checkUVInstalled(): Promise<boolean> {
	try {
		await execAsync("uvx --version")
		return true
	} catch (error) {
		return false
	}
}

export async function promptForUVInstall(): Promise<boolean> {
	const { shouldInstall } = await inquirer.prompt<{ shouldInstall: boolean }>([
		{
			type: "confirm",
			name: "shouldInstall",
			message:
				"UV package manager is required for Python MCP servers. Would you like to install it?",
			default: true,
		},
	])

	if (!shouldInstall) {
		console.warn(
			chalk.yellow(
				"UV installation was declined. You can install it manually from https://astral.sh/uv",
			),
		)
		return false
	}

	const spinner = ora("Installing UV package manager...").start()
	try {
		if (process.platform === "win32") {
			await execAsync(
				'powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"',
			)
		} else {
			try {
				await execAsync("curl -LsSf https://astral.sh/uv/install.sh | sh")
			} catch {
				await execAsync("wget -qO- https://astral.sh/uv/install.sh | sh")
			}
		}

		spinner.succeed("✓ UV installed successfully")
		return true
	} catch (error) {
		spinner.fail(
			"Failed to install UV. You can install it manually from https://astral.sh/uv",
		)
		return false
	}
}

export function isUVRequired(connection: ConnectionDetails): boolean {
	// Check for stdio connection with uvx in stdioFunction
	if (
		connection.type === "stdio" &&
		connection.stdioFunction?.includes("uvx")
	) {
		return true
	}

	return false
}

export async function checkBunInstalled(): Promise<boolean> {
	try {
		await execAsync("bun --version")
		return true
	} catch (error) {
		return false
	}
}

export async function promptForBunInstall(): Promise<boolean> {
	const { shouldInstall } = await inquirer.prompt<{ shouldInstall: boolean }>([
		{
			type: "confirm",
			name: "shouldInstall",
			message:
				"Bun is required for this operation. Would you like to install it?",
			default: true,
		},
	])

	if (!shouldInstall) {
		console.warn(
			chalk.yellow(
				"Bun installation was declined. You can install it manually from https://bun.sh",
			),
		)
		return false
	}

	try {
		console.log("Installing Bun...")
		if (process.platform === "win32") {
			// Windows installation
			await execAsync("powershell -c \"irm bun.sh/install.ps1|iex\"")
		} else {
			try {
				console.log("Attempting to install Bun via Homebrew...")
				await execAsync("brew install oven-sh/bun/bun")
			} catch (brewError) {
				console.log("Homebrew installation failed, trying direct installation...")
				// Fall back to curl method if Homebrew fails
				await execAsync("curl -fsSL https://bun.sh/install | bash")
			}
		}
		console.log(chalk.green("Bun installed successfully!"))
		return true
	} catch (error) {
		console.error(
			chalk.red("Failed to install Bun:"),
			error instanceof Error ? error.message : String(error),
		)
		console.log("Please install Bun manually from https://bun.sh")
		return false
	}
}

export function isBunRequired(connection: ConnectionDetails): boolean {
	// Check for stdio connection with uvx in stdioFunction
	if (
		connection.type === "stdio" &&
		connection.stdioFunction?.includes("bunx")
	) {
		return true
	}

	return false
}

export function getRuntimeEnvironment(
	baseEnv: Record<string, string> = {},
): Record<string, string> {
	const defaultEnv = getDefaultEnvironment();
	
	return {
		...defaultEnv,
		...baseEnv,
	}
}


async function findNpxInNvm(): Promise<string | null> {
  const isWin = process.platform === 'win32';
  const candidates: string[] = [];

  if (isWin) {
    if (process.env.NVM_SYMLINK) candidates.push(join(process.env.NVM_SYMLINK, 'npx.cmd'));
    if (process.env.NVM_HOME) candidates.push(join(process.env.NVM_HOME, process.version, 'npx.cmd'));
  } else {
    if (process.env.NVM_BIN) candidates.push(join(process.env.NVM_BIN, 'npx'));
    if (process.env.NVM_DIR) {
      try {
        const defaultVersion = await fs.readFile(join(process.env.NVM_DIR, 'alias', 'default'), 'utf8').then(v => v.trim());
        candidates.push(join(process.env.NVM_DIR, 'versions', 'node', defaultVersion, 'bin', 'npx'));
      } catch (e) {
        console.debug('[Runtime] Failed to read NVM default alias:', e);
      }
      candidates.push(join(process.env.NVM_DIR, 'versions', 'node', process.version, 'bin', 'npx'));
    }
  }

  // Check all candidates concurrently and take the first valid path
  const results = await Promise.all(
    candidates.map(p => fs.access(p).then(() => p).catch(() => null))
  );
  const validPath = results.find(p => p !== null) || null;

  if (!validPath) console.debug('[Runtime] No NVM npx found in:', candidates);
  return validPath;
}


export async function resolveNpxCommand(originalCommand: string): Promise<string> {
	if (originalCommand !== 'npx') return originalCommand;
	const isWin = process.platform === 'win32';

	// 1. Try which/where command first
	try {
		const { stdout } = await execAsync(isWin ? 'where npx 2>nul' : 'which npx');
		const paths = stdout
			.trim()                     // Remove leading/trailing whitespace first
			.split(/\r?\n/)            // Split on \n or \r\n
			.map(p => p.trim())        // Trim each line again for safety
			.filter(Boolean);          // Remove empty lines
		
		// Check all paths concurrently and take first valid one
		const accessChecks = paths.map(async path => {
			try {
				await access(path);
				return path;
			} catch (e: unknown) {
				console.debug(`[Runtime] Path ${path} inaccessible: ${e instanceof Error ? e.message : String(e)}`);
				return null;
			}
		});
		
		const results = await Promise.all(accessChecks);
		const validPath = results.find(p => p !== null);
		if (validPath) return validPath;
	} catch (error) {
		console.error('[Runtime] which/where command failed to find npx:', error);
	}

	// 2. Check current node process npx
	const nodeDir = process.execPath.replace(isWin ? /[\/\\]node\.exe$/ : /[\/\\]node$/, '');
	const nodeDirNpx = isWin ? join(nodeDir, 'npx.cmd') : join(nodeDir, 'npx');
	try {
		await access(nodeDirNpx);
		return nodeDirNpx;
	} catch {
		console.error('[Runtime] No npx found in current node directory');
	}

	// 3. Check NVM path
	const nvmPath = await findNpxInNvm();
	if (nvmPath) {
		return nvmPath;
	}

	// 4. Check additional system paths as fallback
	const searchPaths: string[] = [];
	if (isWin) {
		// Default npm and Node.js paths
		if (process.env.APPDATA) searchPaths.push(join(process.env.APPDATA, 'npm', 'npx.cmd'));
		if (process.env.ProgramFiles) searchPaths.push(join(process.env.ProgramFiles, 'nodejs', 'npx.cmd'));
		
		// Scoop paths
		if (process.env.USERPROFILE) {
			searchPaths.push(
				join(process.env.USERPROFILE, 'scoop', 'shims', 'npx.cmd'),
				join(process.env.USERPROFILE, 'scoop', 'apps', 'nodejs', 'current', 'npx.cmd')
			);
		}
		
		// Chocolatey path
		searchPaths.push(join('C:', 'ProgramData', 'chocolatey', 'bin', 'npx.cmd'));
	} else {
		searchPaths.push(
			'/opt/homebrew/bin/npx',
			'/usr/local/bin/npx',
			'/usr/bin/npx'
		);
		if (process.env.HOME) searchPaths.push(join(process.env.HOME, '.npm-global', 'bin', 'npx'));
	}

	const results = await Promise.all(
		searchPaths.map(p => access(p).then(() => p).catch(() => null))
	);
	const validPath = results.find(p => p !== null);
	if (validPath) {
		return validPath;
	}

	console.error('[Runtime] Could not resolve npx path');
	return originalCommand;
}