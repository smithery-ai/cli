import inquirer from "inquirer"
import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

async function isClientRunning(client?: string): Promise<boolean> {
	if (!client) return false

	try {
		const platform = process.platform
		const clientProcess =
			{
				claude: "Claude",
			}[client] || client

		if (platform === "win32") {
			const { stdout } = await execAsync(
				`tasklist /FI "IMAGENAME eq ${clientProcess}.exe" /NH`,
			)
			return stdout.includes(`${clientProcess}.exe`)
		} else if (platform === "darwin") {
			const { stdout } = await execAsync(`pgrep -x "${clientProcess}"`)
			return !!stdout.trim()
		} else if (platform === "linux") {
			const { stdout } = await execAsync(
				`pgrep -f "${clientProcess.toLowerCase()}"`,
			)
			return !!stdout.trim()
		}
		return false
	} catch (error) {
		return false
	}
}

async function restartClient(client: string): Promise<void> {
	const clientProcess =
		{
			claude: "Claude",
		}[client] || client

	try {
		const platform = process.platform
		if (platform === "win32") {
			await execAsync(
				`taskkill /F /IM "${clientProcess}.exe" && start "" "${clientProcess}.exe"`,
			)
		} else if (platform === "darwin") {
			await execAsync(
				`killall "${clientProcess}" && open -a "${clientProcess}"`,
			)
		} else if (platform === "linux") {
			await execAsync(
				`pkill -f "${clientProcess.toLowerCase()}" && ${clientProcess.toLowerCase()}`,
			)
		}

		await new Promise((resolve) => setTimeout(resolve, 2000))

		if (platform === "win32") {
			await execAsync(`start "" "${clientProcess}.exe"`)
		} else if (platform === "darwin") {
			await execAsync(`open -a "${clientProcess}"`)
		} else if (platform === "linux") {
			await execAsync(clientProcess.toLowerCase())
		}

		console.log(`${clientProcess} has been restarted.`)
	} catch (error) {
		console.error(`Failed to restart ${clientProcess}:`, error)
	}
}

export async function promptForRestart(client?: string): Promise<boolean> {
	if (!client) return false

	const isRunning = await isClientRunning(client)
	if (!isRunning) {
		return false
	}

	const { shouldRestart } = await inquirer.prompt<{ shouldRestart: boolean }>([
		{
			type: "confirm",
			name: "shouldRestart",
			message: `Would you like to restart the ${client} app to apply changes?`,
			default: true,
		},
	])

	if (shouldRestart) {
		console.log(`Restarting ${client} app...`)
		await restartClient(client)
	}

	return shouldRestart
}
