/**
 * Available agents for the Vercel Labs skills CLI
 * https://github.com/vercel-labs/skills
 *
 * These are the agent identifiers used with `npx skills add --agent <name>`
 */

export const SKILL_AGENTS = [
	"claude-code",
	"cursor",
	"codex",
	"windsurf",
	"cline",
	"roo-code",
	"goose",
	"continue",
	"github-copilot",
	"opencode",
	"openhands",
	"junie",
	"codebuddy",
	"command-code",
	"amp",
	"antigravity",
	"augment",
	"crush",
	"droid",
	"gemini-cli",
	"kilo-code",
	"kiro-cli",
	"kode",
	"mcpjam",
	"mistral-vibe",
	"mux",
	"pi",
	"qoder",
	"qwen-code",
	"replit",
	"trae",
	"trae-cn",
	"zencoder",
	"neovate",
	"pochi",
	"adal",
	"iflow-cli",
] as const

export type SkillAgent = (typeof SKILL_AGENTS)[number]
