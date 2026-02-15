import type { Command } from "commander"

  interface CompletionItem {
        name: string
        description: string
  }

  interface TabtabEnv {
        complete: boolean
        line: string
        last: string
        lastPartial: string
        prev: string
  }

  /**
   * Walk the Commander.js command tree based on the words the user has already
   * typed and return completion items for the current position.
   */
  export function getCompletions(
        program: Command,
        env: TabtabEnv,
  ): CompletionItem[] {
        const allWords = env.line.split(/\s+/).filter(Boolean)
        // Drop the binary name (e.g. "smithery")
        const words = allWords.slice(1)

        // Apply the same plural→singular aliases the CLI uses at runtime
        const COMMAND_ALIASES: Record<string, string> = {
                tools: "tool",
                skills: "skill",
        }

        let current: Command = program

        // `env.last` is the partial word being typed (empty string if cursor follows a space).
        // All words before `last` are fully completed — walk those to find the current command.
        const lastWord = env.last ?? ""
        const completed = lastWord === "" ? words : words.slice(0, -1)

        for (const word of completed) {
                if (word.startsWith("-")) continue // skip flags
                const resolved = COMMAND_ALIASES[word] ?? word
                const sub = current.commands.find(
                        (c: Command) => c.name() === resolved || c.aliases().includes(resolved),
                )
                if (sub) {
                        current = sub
                } else {
                        break
                }
        }

        const items: CompletionItem[] = []

        // Add visible subcommands
        for (const cmd of current.commands) {
                if ((cmd as any)._hidden) continue
                items.push({
                        name: cmd.name(),
                        description: cmd.description(),
                })
        }

        // Add options when the user is typing a flag (starts with "-")
        if (lastWord.startsWith("-")) {
                for (const opt of current.options) {
                        if ((opt as any).hidden) continue
                        const flag = opt.long || opt.short || ""
                        items.push({
                                name: flag,
                                description: opt.description,
                        })
                }

                // Also include parent (global) options when at a subcommand
                if (current.parent) {
                        for (const opt of current.parent.options) {
                                if ((opt as any).hidden) continue
                                const flag = opt.long || opt.short || ""
                                items.push({
                                        name: flag,
                                        description: opt.description,
                                })
                        }
                }
        }

        return items
  }