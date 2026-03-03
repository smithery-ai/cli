# Tree-Based Tool Navigation Benchmark

How should agents discover and call tools when an MCP server exposes hundreds of them?

We benchmarked naming conventions, discovery strategies, and command surface area against 826 GitHub API tools to find out.

**Branch**: `henry/smi-1564-tree-based-toolevent-naming`
**Models**: Claude Haiku 4.5, OpenAI Codex (gpt-5.3) | **Server**: 826 GitHub API tools, max depth 7
**Runs**: 2 per task per variant | **Max turns**: 8 (Haiku), unlimited (Codex)

## Motivation

MCP servers can expose hundreds of tools. Agents need to discover the right tool and call it within a limited turn budget. We tested three axes:

1. **Naming**: flat (`repos_issues_create`) vs hierarchical (`repos.issues.create` / `repos/issues/create`)
2. **Discovery**: tree browsing only vs semantic search (`tool find`) vs Unix grep (`--all | grep`)
3. **Command surface**: 3 separate commands vs 1 unified command

## Method

Each experiment controls one variable. Two design principles:

1. **Blocking, not instructing**: Unwanted commands are blocked at runtime (wrapper returns an error) rather than omitted from instructions — agents never see "do not use X", they simply can't.

2. **Guided vs organic prompting**: E1 explicitly teaches browsing patterns (example drill-down sequences) since it tests browsing effectiveness specifically. E2–E4 use minimal prompting — agents receive a short command reference (command name, flags, one-line description) and must discover strategies like `--all | grep` organically.

**Model differences**: Haiku runs via `claude -p --max-turns 8` — each tool call costs one LLM round-trip. Codex runs via `codex exec` — all commands execute within a single inference call (effectively unlimited turns). Both models receive identical CLAUDE.md/AGENTS.md instructions.

### Tasks

9 tasks at varying depths in the GitHub API hierarchy, shared across all experiments:

| Task | Target Tool | Depth |
|------|------------|-------|
| create-gist | `gists.create` | 2 |
| search-code | `search.code.list` | 3 |
| create-issue | `repos.issues.create` | 3 |
| create-release | `repos.releases.create` | 3 |
| add-issue-label | `repos.issues.labels.create` | 4 |
| create-pr-review | `repos.pulls.reviews.create` | 4 |
| list-actions-run-jobs | `repos.actions.runs.jobs.list` | 5 |
| create-issue-comment-reaction | `repos.issues.comments.reactions.create` | 5 |
| list-pr-review-comments | `repos.pulls.reviews.comments.list` | 5 |

---

## Experiment 1: Flat vs tree naming (browse only, guided)

**Question**: Does hierarchical naming help when agents can only browse?

All variants block `find` and `get` — agents have only `tool list` and `tool call`. CLAUDE.md teaches browsing patterns with example drill-down sequences.

| Variant | Tool names | Discovery |
|---------|-----------|-----------|
| flat | `repos_issues_create` | paginated `tool list` (10/page) |
| tree-dot | `repos.issues.create` | `tool list github repos.` |
| tree-slash | `repos/issues/create` | `tool list github repos/` |

### Results

| Variant | Haiku Success | Codex Success | Haiku Hops | Codex Hops |
|---------|--------------|--------------|------------|------------|
| flat | 11% | 83% | 2.0 | 5.3 |
| **tree-dot** | **50%** | **89%** | 3.1 | 4.8 |
| **tree-slash** | **55%** | 83% | 3.7 | 4.2 |

&nbsp;

| Task | Depth | Flat H/C | Dot H/C | Slash H/C |
|------|-------|----------|---------|-----------|
| create-gist | 2 | 2/2 — 2/2 | 2/2 — 2/2 | 2/2 — 2/2 |
| search-code | 3 | 0/2 — 2/2 | 0/2 — 2/2 | 0/2 — 2/2 |
| create-issue | 3 | 0/2 — 2/2 | 2/2 — 2/2 | 2/2 — 2/2 |
| add-issue-label | 4 | 0/2 — 1/2 | 2/2 — 2/2 | 2/2 — 2/2 |
| create-pr-review | 4 | 0/2 — 2/2 | 1/2 — 2/2 | 1/2 — 2/2 |
| create-release | 3 | 0/2 — 2/2 | 0/2 — 2/2 | 1/2 — 2/2 |
| list-pr-review-comments | 5 | 0/2 — 0/2 | 1/2 — 0/2 | 0/2 — 0/2 |
| create-issue-comment-reaction | 5 | 0/2 — 2/2 | 0/2 — 2/2 | 0/2 — 2/2 |
| list-actions-run-jobs | 5 | 0/2 — 2/2 | 1/2 — 2/2 | 2/2 — 1/2 |

**Findings**:
- **Haiku**: Tree hierarchy gives a +39–44pp advantage over flat. Flat browsing through 826 tools is nearly hopeless within 8 turns — only `create-gist` (depth 2, first page) succeeds. Dot and slash perform similarly (50% vs 55%).
- **Codex**: Unlimited turns compress the gap — flat jumps to 83% (+72pp over Haiku). Tree-dot still leads (89%) but the advantage over flat shrinks from +39pp to +6pp. With enough commands, even paginating through 826 flat tools works.
- **Both**: All variants fail on `list-pr-review-comments` — agents look under `repos.pulls.comments.` instead of `repos.pulls.reviews.comments.`.

---

## Experiment 2: Does `tool find` help? (organic)

**Question**: How much does adding semantic search improve results over tree browsing alone?

Both variants use dot-separated tree names. `browse-only` blocks find+get; `browse+find` blocks only get. Minimal prompting — agents receive a command reference only, no examples.

| Variant | Discovery |
|---------|-----------|
| browse-only | `tool list` + `tool call` only |
| browse+find | `tool list` + `tool find` + `tool call` |

### Results

| Variant | Haiku Success | Codex Success | Haiku Hops | Codex Hops |
|---------|--------------|--------------|------------|------------|
| browse-only | 72% | 89% | 3.0 | 3.9 |
| browse+find | 67% | 83% | 2.0 | 2.7 |

&nbsp;

| Task | Depth | Browse H/C | Browse+Find H/C |
|------|-------|------------|-----------------|
| create-gist | 2 | 1/2 — 2/2 | 1/2 — 2/2 |
| search-code | 3 | 0/2 — 2/2 | 1/2 — 2/2 |
| create-issue | 3 | 2/2 — 2/2 | 2/2 — 2/2 |
| create-release | 3 | 2/2 — 2/2 | 2/2 — 2/2 |
| add-issue-label | 4 | 2/2 — 2/2 | 2/2 — 2/2 |
| create-pr-review | 4 | 2/2 — 2/2 | 2/2 — 1/2 |
| list-actions-run-jobs | 5 | 2/2 — 2/2 | 2/2 — 2/2 |
| create-issue-comment-reaction | 5 | 2/2 — 2/2 | 0/2 — 2/2 |
| list-pr-review-comments | 5 | 0/2 — 0/2 | 0/2 — 0/2 |

**Findings**:
- **Haiku**: Adding `tool find` doesn't clearly improve success (67% vs 72%, within noise). But when agents use find, they reach tools faster: 2.0 hops vs 3.0, 2.7 turns vs 4.3. Tree browsing alone is surprisingly effective at 72%.
- **Codex**: Same pattern — browse-only edges out browse+find (89% vs 83%). Find reduces hops (2.7 vs 3.9) but doesn't boost success rates. Agents sometimes pick wrong find results (e.g., `create-pr-review` 1/2 with find).
- **Both**: `list-pr-review-comments` fails 0/2 in all variants for both models.

---

## Experiment 3: `tool find` vs `tool list --all | grep` (organic)

**Question**: Is native semantic search better than dumping all tools and grepping?

Both variants use dot-tree names. The grep variant blocks both `find` and `get`; find blocks only `get`. Neither variant is taught how to use `--all | grep` — agents must discover it from the `--all` parenthetical in the command reference.

| Variant | Discovery commands |
|---------|-------------------|
| find | `tool list` (browse) + `tool find` (search) + `tool call` |
| grep | `tool list` (browse, `--all` available) + `tool call` |

### Results

| Variant | Haiku Success | Codex Success | Haiku Hops | Codex Hops |
|---------|--------------|--------------|------------|------------|
| **find** | **78%** | 83% | 2.6 | 2.2 |
| grep | 61% | 83% | 3.4 | 3.3 |

&nbsp;

| Task | Depth | Find H/C | Grep H/C |
|------|-------|----------|----------|
| create-gist | 2 | 2/2 — 2/2 | 2/2 — 2/2 |
| search-code | 3 | 2/2 — 2/2 | 0/2 — 2/2 |
| create-issue | 3 | 2/2 — 2/2 | 2/2 — 2/2 |
| create-release | 3 | 2/2 — 2/2 | 2/2 — 2/2 |
| add-issue-label | 4 | 2/2 — 2/2 | 1/2 — 1/2 |
| create-pr-review | 4 | 2/2 — 2/2 | 1/2 — 2/2 |
| list-actions-run-jobs | 5 | 2/2 — 1/2 | 1/2 — 2/2 |
| create-issue-comment-reaction | 5 | 0/2 — 2/2 | 1/2 — 2/2 |
| list-pr-review-comments | 5 | 0/2 — 0/2 | 1/2 — 0/2 |

**Findings**:
- **Haiku**: `tool find` wins by +17pp (78% vs 61%) with fewer hops and turns. Find is more discoverable — agents see a search command and use it. Grep requires agents to independently compose `tool list --all | grep`, and most fall back to tree browsing instead.
- **Codex**: Both reach 83% — Codex's unlimited turns let grep-fallback-to-browsing succeed where Haiku runs out of turns. But find still produces fewer hops (2.2 vs 3.3), making it the more efficient path.
- **Both**: `list-pr-review-comments` fails across the board. `search-code` is the clearest find advantage — the `search.` prefix is unintuitive for both browsing and grepping.

---

## Experiment 4: `| grep` with 3 commands vs 1 unified command (organic)

**Question**: Does a single unified command improve the grep workflow?

`stool` wraps all tool operations into one command: `stool <connection> [path] [args]`. Trailing dot browses, `--all` dumps for grep, adding JSON args calls. Both variants block `find` and `get`.

| Variant | UX | Example |
|---------|-----|---------|
| grep | 3 commands | `smithery tool list --all \| grep`, `tool list`, `tool call` |
| unified | 1 command | `stool github --all \| grep`, `stool github prefix.`, `stool github tool '{}'` |

### Results

| Variant | Haiku Success | Codex Success | Haiku Hops | Codex Hops |
|---------|--------------|--------------|------------|------------|
| grep | 50% | 78% | 3.2 | 3.9 |
| unified | 44% | 78% | 2.1 | 5.5 |

&nbsp;

| Task | Depth | Grep H/C | Unified H/C |
|------|-------|----------|-------------|
| create-gist | 2 | 1/2 — 2/2 | 1/2 — 2/2 |
| search-code | 3 | 1/2 — 2/2 | 0/2 — 2/2 |
| create-issue | 3 | 1/2 — 2/2 | 1/2 — 2/2 |
| create-release | 3 | 1/2 — 2/2 | 2/2 — 2/2 |
| add-issue-label | 4 | 2/2 — 1/2 | 0/2 — 2/2 |
| create-pr-review | 4 | 1/2 — 1/2 | 1/2 — 0/2 |
| list-actions-run-jobs | 5 | 2/2 — 2/2 | 0/2 — 2/2 |
| create-issue-comment-reaction | 5 | 0/2 — 2/2 | 2/2 — 2/2 |
| list-pr-review-comments | 5 | 0/2 — 0/2 | 1/2 — 0/2 |

**Findings**:
- **Haiku**: Both variants perform poorly (50% grep, 44% unified) — worse than E2/E3. The unfamiliar `stool` command and lack of `tool find` compound. The unified command confuses rather than simplifies.
- **Codex**: Both reach 78%, tied. Unlimited turns rescue the grep/unified workflows that Haiku can't complete in 8 turns. But unified takes more hops (5.5 vs 3.9) — the overloaded semantics still cause inefficiency.
- **Both**: `list-pr-review-comments` fails in all variants (0/4 across both models). `create-pr-review` also struggles with the unified command (0/2 Codex, 1/2 Haiku).

---

## Conclusions

### CLI design matters most under turn pressure

Haiku's 8-turn cap creates a 67pp spread between the best strategy (find, 78%) and worst (flat, 11%). Codex's unlimited turns compress this to 11pp (83–89%). **Good UX is most valuable when agents are resource-constrained** — which is the common case, since turn budgets control cost.

### Key findings (organic experiments E2–E4)

1. **`tool find` is the most discoverable and efficient path** — Haiku: 78%, Codex: 83%, fewest hops for both (2.6 / 2.2). Agents see a search command and use it without coaching.

2. **Tree browsing alone is surprisingly effective** — Haiku: 72%, Codex: 89%. Agents navigate the dot-separated hierarchy competently without needing a dedicated search command.

3. **Agents don't discover `--all | grep` organically** — Haiku grep variants (61%, 50%) perform worse than browse-only (72%). Codex rescues grep to 83% via brute-force browsing, but even then, find produces fewer hops. The `--all` flag mentioned in a parenthetical is not enough.

4. **A unified command doesn't help** — Haiku: 44% vs 50% (grep). Codex: 78% vs 78% (tied but more hops). Overloading one command with browse/search/call semantics confuses rather than simplifies.

5. **One task defeats both models** — `list-pr-review-comments` (depth 5) fails 0/2 in nearly every variant for both models. Agents look under `repos.pulls.comments.` instead of `repos.pulls.reviews.comments.` — a naming ambiguity, not a turn-budget problem.

### Guided experiment E1

6. **Tree hierarchy is essential under turn pressure** — With guided browsing instructions, Haiku scores 50–55% on tree vs 11% on flat (+39–44pp). Codex compresses this to 83–89% vs 83% — with enough turns, even flat pagination through 826 tools works.

### Caveats

7. **Noise is significant at 2 runs/task** — identical configs across experiments show ~20pp variance. Individual task results should be interpreted with caution.

8. **Codex turns are not comparable** — Codex always reports turns=1 (single inference call, unlimited commands). Haiku uses up to 8 LLM round-trips. The models are compared on success rate and hops, not turns.

### Recommended CLI surface

```
tool list <connection> [prefix.]     — browse tree hierarchy (primary discovery)
tool find <connection> "keyword"     — semantic search (most discoverable, fewest hops)
tool list <connection> --all | grep  — Unix pipes for power users (not organically discovered)
tool call <connection> <tool> '{}'   — call a tool
```

Tree browsing is the foundation — agents use it naturally and effectively. `tool find` adds the most value as a dedicated search command that agents discover and use without coaching. `tool list --all | grep` works when taught, but agents don't compose it independently — keep it for power users. Drop `tool get` (schema inspection) — agents call tools directly from name + description.
