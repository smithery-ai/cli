# Smithery CLI

## Build & Test
- **Package manager**: `pnpm` (not npm)
- **Build**: `pnpm run build` (runs tsc + esbuild via build.mjs)
- **Test**: `pnpm test`
- **Lint**: `pnpm run lint`

## Project Structure
- `src/index.ts` — CLI entry point, all command definitions
- `src/commands/` — command implementations (mcp/, skill/, namespace/, run/, auth/)
- `src/lib/` — shared libraries (registry, build, etc.)
- `src/utils/` — utility functions
- `dist/` — build output
