import pc from "picocolors"

export const DISCORD_INVITE_URL = "https://discord.gg/sKd9uycgH9"

export function showDiscordInvite() {
	console.log()
	console.log(
		pc.dim("Join the Smithery community: ") + pc.cyan(DISCORD_INVITE_URL),
	)
}
