---
name: smithery-homepage
description: "Build and edit the Smithery homepage app -- a TanStack Start + shadcn/ui web app at ~/.smithery/homepage that connects to MCP servers through the Smithery Connect API. Use this skill whenever the user wants to create, modify, or add features to the Smithery homepage, build pages that display data from MCP tools (Linear issues, Gmail, Notion, etc.), or asks about editing anything in ~/.smithery/homepage. Also triggers for requests like 'add a page to the homepage', 'show my Linear issues on the homepage', 'update the homepage UI', or any task involving the ~/.smithery/homepage project."
---

# Smithery Homepage

The Smithery homepage is a TanStack Start app at `~/.smithery/homepage` that serves as a personal dashboard connecting to MCP servers via the Smithery Connect API.

## Project Initialization

If `~/.smithery/homepage` does not exist, scaffold it from scratch:

1. Create the directory if needed and scaffold the app in place:
   ```bash
   mkdir -p ~/.smithery
   cd ~/.smithery && npx shadcn@latest init --preset b1FSjVe3E --template start --name homepage
   ```
2. Install additional dependencies:
   ```bash
   cd ~/.smithery/homepage
   npm install @smithery/api @modelcontextprotocol/sdk @tanstack/react-query @tanstack/react-query-devtools
   ```
3. Initialize git: `git init && git add -A && git commit -m "feat: initial commit"`
4. Create `.env` with the user's Smithery API key and namespace (read from `~/Library/Application Support/smithery/settings.json` on macOS — fields `apiKey` and `namespace`)

If `~/.smithery/homepage` already exists, work within the existing project — read the current code before making changes.

## Tech Stack

- **Framework**: TanStack Start (Vite 7, React 19, file-based routing)
- **Styling**: Tailwind CSS v4 + shadcn/ui (radix-nova style, taupe base). **Always use shadcn components with their default styling** unless absolutely necessary or explicitly requested otherwise. This applies especially to charts — use shadcn's chart components (built on Recharts) rather than custom chart implementations.
- **Data Fetching**: `@tanstack/react-query` (React Query) — ALL API requests MUST use React Query
- **MCP Integration**: `@smithery/api` + `@modelcontextprotocol/sdk`
- **Server functions**: `createServerFn` from `@tanstack/react-start` for server-side MCP calls

## CRITICAL: React Query for ALL API Requests

**Every API request in the app MUST use React Query (`@tanstack/react-query`).** Do not use raw `fetch`, `useEffect` + `useState`, or route loaders alone for data fetching. React Query provides caching, background refetching, loading/error states, and stale-while-revalidate — all of which are essential for a good dashboard UX.

### QueryClient Setup

The `QueryClient` must be configured in the router and provided at the root layout. The scaffold generates `getRouter()` — update it to add the QueryClient:

```typescript
// src/router.tsx
import { QueryClient } from "@tanstack/react-query"
import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60, // 1 minute
        refetchOnWindowFocus: true,
      },
    },
  })

  return createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
```

The scaffold generates `__root.tsx` with `createRootRoute` and a `shellComponent` for the HTML document wrapper. Replace `createRootRoute` with `createRootRouteWithContext` to pass QueryClient, keep the `shellComponent`, and add a `component` with QueryClientProvider:

```typescript
// src/routes/__root.tsx
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import type { QueryClient } from "@tanstack/react-query"
import appCss from "../styles.css?url"

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Dashboard" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  const { queryClient } = Route.useRouteContext()
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <ReactQueryDevtools />
    </QueryClientProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

## Project Structure

```
~/.smithery/homepage/
├── src/
│   ├── routes/          # File-based routes (TanStack Router)
│   │   ├── __root.tsx   # Root layout with QueryClientProvider
│   │   └── index.tsx    # Home page
│   ├── components/ui/   # shadcn components
│   ├── lib/             # Server-side helpers (MCP tool callers)
│   │   └── schemas/     # Cached Zod schemas copied from ~/.smithery/
│   ├── router.tsx       # Router setup with QueryClient
│   ├── routeTree.gen.ts # Auto-generated route tree
│   └── styles.css       # Tailwind + shadcn theme
├── .env                 # SMITHERY_API_KEY
├── components.json      # shadcn config
├── package.json
├── tsconfig.json
└── vite.config.ts       # (if present)
```

## How to Connect to MCP Servers

The app uses `@smithery/api/mcp` to create MCP connections through Smithery Connect. This runs server-side via TanStack Start server functions — the API key never reaches the browser.

### Pattern: Shared MCP helper

Create a shared `src/lib/mcp.ts` that handles MCP connections for any server:

```typescript
// src/lib/mcp.ts
import { createConnection } from "@smithery/api/mcp"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"

const NAMESPACE = process.env.SMITHERY_NAMESPACE ?? ""

export async function callMcpTool(
  connectionId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { transport } = await createConnection({
    namespace: NAMESPACE,
    connectionId,
  })

  const client = new Client({ name: "homepage", version: "1.0.0" })
  await client.connect(transport)

  try {
    const result = await client.callTool({ name: toolName, arguments: args })
    const content = result.content
    if (!Array.isArray(content)) return null
    const textBlock = content.find(
      (c): c is { type: "text"; text: string } => c.type === "text",
    )
    return textBlock?.text ? JSON.parse(textBlock.text) : null
  } finally {
    await client.close()
  }
}
```

### Pattern: Creating a tool caller module

**CRITICAL: Always use cached tool schemas for type safety.** The Smithery CLI caches Zod schemas for tool inputs and outputs at `~/.smithery/<connection>__<tool_name>.ts` after each successful tool call. These schemas contain the **real** input and output types — never hand-write or guess tool response types. **Never use `as` type casting on tool results.** Always parse results through the cached `outputSchema` to get proper types at runtime.

#### Step 1: Ensure the schema exists

Before writing a tool caller module, check if the cached schema file exists at `~/.smithery/<connection>__<tool_name>.ts`. If it does NOT exist, you MUST run the tool first to generate it:

```bash
smithery mcp call <connection> <tool_name> [--args '{}']
```

This creates the schema file with accurate `inputSchema`, `Input`, `outputSchema`, and `Output` types inferred from the real tool response. **You must always run the tool to generate the schema before writing code that depends on it — do not guess or hallucinate tool response shapes.**

#### Step 2: Copy the schema into the homepage project

Copy the cached schema file into the homepage's `src/lib/schemas/` directory so it's part of the project and available to the TypeScript compiler:

```bash
mkdir -p ~/.smithery/homepage/src/lib/schemas
cp ~/.smithery/<connection>__<tool_name>.ts ~/.smithery/homepage/src/lib/schemas/
```

Also ensure `zod` is installed in the homepage project (`npm install zod` if needed).

#### Step 3: Import schemas and parse tool results

For each MCP server, create a helper in `src/lib/` that imports the shared MCP helper AND the cached schemas. Import `outputSchema` (the Zod schema) to parse results, and `type Input` for compile-time argument checking:

```typescript
// src/lib/linear.ts
import { createServerFn } from "@tanstack/react-start"
import { queryOptions } from "@tanstack/react-query"
import { callMcpTool } from "./mcp"
import type { Input as ListIssuesInput } from "./schemas/linear__list_issues"
import { outputSchema as listIssuesOutputSchema } from "./schemas/linear__list_issues"

// Server functions (called by React Query from the client)
export const fetchIssues = createServerFn({ method: "GET" }).handler(
  async () => {
    const raw = await callMcpTool("linear", "list_issues", {
      assignee: "me",
      includeArchived: false,
    } satisfies ListIssuesInput)
    const data = listIssuesOutputSchema.parse(raw)
    return data.issues.filter(
      (i) => i.statusType !== "canceled" && i.statusType !== "completed"
    )
  },
)

// Query options factory — use this in routes and components
export const issuesQueryOptions = () =>
  queryOptions({
    queryKey: ["linear", "issues"],
    queryFn: () => fetchIssues(),
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
```

**Key points:**
- Use `satisfies Input` on the args object to catch invalid tool inputs at compile time
- **Always parse results with `outputSchema.parse(raw)`** — this validates the data at runtime AND gives you the correct TypeScript type. Never use `as` casting on tool results.
- Never hand-write tool response types — always derive them from the cached schema
- If a schema file seems stale, re-run the tool (`smithery mcp call ...`) to regenerate it

### Server functions with input parameters

**IMPORTANT**: `.validator()` does NOT exist in TanStack Start. For server functions that accept input:

- For **GET** server functions, type the handler's `{ data }` parameter directly:
  ```typescript
  export const fetchItem = createServerFn({ method: "GET" }).handler(
    async ({ data }: { data: { id: string } }) => {
      return callMcpTool("service", "get_item", { item_id: data.id })
    },
  )
  // Call: fetchItem({ data: { id: "123" } })
  ```

- For **POST** mutations, use `.inputValidator()` (not `.validator()`):
  ```typescript
  export const createItem = createServerFn({ method: "POST" })
    .inputValidator((data: { title: string }) => data)
    .handler(async ({ data }) => {
      return callMcpTool("service", "create_item", { title: data.title })
    })
  ```

### Pattern: Using React Query in routes

Use `queryOptions` + `useQuery` for data fetching. Prefetch in the route loader for instant navigation, then read via React Query in the component. Always destructure `isLoading`, `error`, and `refetch` alongside `data` to handle all states.

```typescript
// src/routes/issues.tsx
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { issuesQueryOptions } from "@/lib/linear"

export const Route = createFileRoute("/issues")({
  loader: ({ context: { queryClient } }) =>
    // Use void to fire-and-forget — don't block navigation on data
    void queryClient.ensureQueryData(issuesQueryOptions()),
  component: IssuesPage,
})

function IssuesPage() {
  const { data: issues, isLoading, error, refetch } = useQuery(issuesQueryOptions())
  // Handle all three states: loading, error, success
  return (/* render issues */)
}
```

### CRITICAL: Loading & Error Handling

**Every component that uses `useQuery` MUST handle loading and error states.** Never render only the success case.

#### Standard loading/error pattern

Use `isLoading` and `error` from `useQuery`, plus a skeleton loader and an error component with retry:

```typescript
function DataSection() {
  const { data, isLoading, error, refetch } = useQuery(dataQueryOptions())

  return (
    <Card>
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState message="Failed to load data" onRetry={() => refetch()} />
        ) : (
          <div>{/* render data */}</div>
        )}
      </CardContent>
    </Card>
  )
}
```

#### Reusable ErrorState component

Always include a retry button so users can recover from transient failures:

```typescript
function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 p-6 text-center">
      <AlertCircle className="text-destructive h-5 w-5" />
      <p className="text-destructive text-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
```

#### CardDescription should reflect state

Update card descriptions to show loading/error/count:

```typescript
<CardDescription>
  {isLoading ? "Loading..." : error ? "Error" : `${data?.length ?? 0} items`}
</CardDescription>
```

#### Mutation error handling

Show inline error messages for mutations (e.g., inside a dialog):

```typescript
{mutation.error && (
  <p className="text-destructive text-sm">
    Failed to create item. Please try again.
  </p>
)}
```

### Pattern: Mutations with React Query

For actions that modify data (creating issues, updating status, etc.), use `useMutation`:

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createIssue } from "@/lib/linear"

function CreateIssueButton() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (input: { title: string }) => createIssue(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linear", "issues"] })
    },
  })

  return (
    <button onClick={() => mutation.mutate({ title: "New issue" })}>
      {mutation.isPending ? "Creating..." : "Create Issue"}
    </button>
  )
}
```

### Pattern: Polling / real-time updates

For data that should stay fresh (e.g., notifications), use `refetchInterval`:

```typescript
const { data } = useQuery({
  queryKey: ["notifications"],
  queryFn: () => fetchNotifications(),
  refetchInterval: 1000 * 30, // poll every 30 seconds
})
```

### Query key conventions

Organize query keys hierarchically by service and resource:

- `["linear", "issues"]` — all issues
- `["linear", "issues", issueId]` — single issue
- `["gmail", "messages", { label: "inbox" }]` — filtered messages
- `["notion", "pages"]` — all pages

This enables targeted invalidation: `queryClient.invalidateQueries({ queryKey: ["linear"] })` invalidates all Linear queries.

## Finding the Namespace and API Key

The Smithery settings file on macOS is at:
```
~/Library/Application Support/smithery/settings.json
```

It contains:
```json
{
  "apiKey": "smry_...",
  "namespace": "..."
}
```

The `.env` file should have both values:
```
SMITHERY_API_KEY=<the apiKey from settings>
SMITHERY_NAMESPACE=<the namespace from settings>
```
The `@smithery/api` client reads `SMITHERY_API_KEY` automatically. `SMITHERY_NAMESPACE` is used by the MCP helper to identify the user's namespace for connections.

To find which MCP connections are available, use the Smithery CLI:
```bash
smithery mcp list
```

Or check a specific connection's tools:
```bash
smithery tool list <connection-id> --flat --limit 100
smithery tool get <connection-id> <tool-name>
```

## Adding shadcn Components

```bash
cd ~/.smithery/homepage
npx shadcn@latest add <component-name>
```

Components install to `src/components/ui/`. Import as `@/components/ui/<name>`.

## Adding New Pages

1. **Generate schemas first**: For each MCP tool the page will use, check if `~/.smithery/<connection>__<tool>.ts` exists. If not, run `smithery mcp call <connection> <tool>` to generate it, then copy it to `src/lib/schemas/`.
2. Create `src/routes/<page-name>.tsx` with `createFileRoute("/<page-name>")`
3. The route tree auto-regenerates on dev server restart
4. Define `queryOptions` in the relevant `src/lib/` module, importing types from `./schemas/`
5. Prefetch in the route `loader` with `queryClient.ensureQueryData(...)`
6. Read data in the component with `useSuspenseQuery(...)`
7. Add navigation links in `__root.tsx` if needed

## Committing Changes

After making changes, always commit:

```bash
cd ~/.smithery/homepage
git add -A
git commit -m "<descriptive commit message>"
```

Use conventional commit prefixes: `feat:`, `fix:`, `style:`, `refactor:`.

## Running the App

The homepage runs as a background daemon via the Smithery CLI. Before making changes, ensure the daemon is running:

```bash
smithery homepage up      # Start the daemon (idempotent — safe to call if already running)
smithery homepage status  # Check if it's running
smithery homepage down    # Stop the daemon
```

`smithery homepage up` auto-installs portless if needed, starts Vite in the background, and serves the app at **https://smithery.localhost** with automatic HTTPS.

The daemon uses Vite's dev server, so **file changes auto-reload via HMR** — no restart needed after editing code. Logs are written to `~/.smithery/homepage.log`.

After making changes to the homepage, tell the user to visit **https://smithery.localhost** to see the result. If the daemon is not running, start it with `smithery homepage up` first.

## Smithery Connect API Reference

For direct REST calls (alternative to the SDK), see `references/connect-api.md`.
