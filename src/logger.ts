import chalk from "chalk"

let isVerbose = false

export function setVerbose(value: boolean): void {
	isVerbose = value
}

export function verbose(message: string): void {
	if (isVerbose) {
		console.log(chalk.gray(`[verbose] ${message}`))
	}
}
