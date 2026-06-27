/**
 * npm global CLIs on Windows are exposed as `.cmd` shims.
 * execFileSync does not apply PATHEXT, so the shim suffix is required.
 */
export function resolveNpmCliCommand(command: string): string {
	return process.platform === "win32" ? `${command}.cmd` : command
}
