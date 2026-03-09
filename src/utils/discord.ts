import pc from "picocolors"

export const DISCORD_INVITE_URL = "https://discord.gg/sKd9uycgH9"

// Discord brand color "blurple" (#5865F2) as ANSI 256-color escape
const blurple = (text: string) => `\x1b[38;2;88;101;242m${text}\x1b[39m`

export function showDiscordInvite() {
	console.log()
	console.log(
		pc.dim("Join the Smithery community: ") + blurple(DISCORD_INVITE_URL),
	)
}
