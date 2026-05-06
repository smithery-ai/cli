import pc from "picocolors"
import {
	getProfile,
	getProfiles,
	switchProfile,
} from "../../utils/smithery-settings"

export async function switchNamespace(name: string): Promise<void> {
	// Check if profile exists locally
	const profile = await getProfile(name)

	if (!profile) {
		const profiles = await getProfiles()
		const availableProfiles = Object.keys(profiles)

		console.error(pc.red(`Profile "${name}" not found in local cache.`))

		if (availableProfiles.length > 0) {
			console.error(
				pc.gray(`Available cached profiles: ${availableProfiles.join(", ")}`),
			)
			console.error(
				pc.gray(
					`Run 'smithery auth login --organization ${name}' to add this profile.`,
				),
			)
		} else {
			console.error(
				pc.gray(
					`No profiles found. Run 'smithery auth login' to authenticate.`,
				),
			)
		}
		process.exit(1)
	}

	const result = await switchProfile(name)
	if (!result.success) {
		console.error(pc.red("Failed to switch profile."))
		console.error(pc.gray(result.error))
		process.exit(1)
	}

	console.log(pc.green(`✓ Switched to namespace: ${name}`))
	if (profile.authOrganization?.name) {
		console.log(pc.gray(`Organization: ${profile.authOrganization.name}`))
	}
}
