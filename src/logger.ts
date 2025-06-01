import chalk from "chalk"

let isVerbose = false
let isDebug = false

export function setVerbose(value: boolean): void {
	isVerbose = value
}

export function setDebug(value: boolean): void {
	isDebug = value
}

export function verbose(message: string): void {
	if (isVerbose) {
		console.log(chalk.gray(`[verbose] ${message}`))
	}
}

export function debug(message: string): void {
	if (isDebug) {
		console.debug(chalk.blue(`[debug] ${message}`))
	}
}
