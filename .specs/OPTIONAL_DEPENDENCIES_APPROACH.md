# Optional Dependencies Approach for Smithery CLI

## Problem Statement

The Smithery CLI currently bundles all dependencies (~20-25MB) even for lightweight commands like `install` and `list`. This results in:
- Slow NPX execution for common use cases
- Unnecessary bandwidth usage
- Poor user experience for simple operations

## Proposed Solution: Optional Dependencies

Move heavy, feature-specific dependencies to `optionalDependencies` and install them on-demand when needed.

## Current Dependency Analysis

### Heavy Dependencies by Command Usage:

| Dependency | Size | Used By | Essential For |
|------------|------|---------|---------------|
| `esbuild` | ~8MB | `dev`, `build` | Development only |
| `@ngrok/ngrok` | ~5MB | `dev`, `playground` | Development only |
| `express` | ~2MB | `playground`, runtime | Development only |
| `cors` | ~1MB | `playground`, runtime | Development only |
| `inquirer` | ~2MB | All interactive commands | Core functionality |
| `chalk` | ~1MB | All commands | Core functionality |
| `commander` | ~1MB | All commands | Core functionality |

### Command Usage Patterns:
- **Most common**: `install`, `list`, `uninstall` (lightweight operations)
- **Less common**: `dev`, `build`, `playground` (development operations)

## Approach Comparison

### 1. Optional Dependencies (Recommended)

#### Implementation:
```json
{
  "dependencies": {
    "chalk": "^4.1.2",
    "commander": "^14.0.0",
    "inquirer": "^8.2.4",
    "yaml": "^2.3.4",
    "cross-fetch": "^4.1.0"
  },
  "optionalDependencies": {
    "@ngrok/ngrok": "^1.5.1",
    "esbuild": "^0.25.5", 
    "express": "^5.1.0",
    "cors": "^2.8.5"
  }
}
```

#### Runtime Check:
```typescript
async function ensureDevDependencies() {
  const missing = []
  
  try { await import("esbuild") } catch { missing.push("esbuild") }
  try { await import("@ngrok/ngrok") } catch { missing.push("@ngrok/ngrok") }
  
  if (missing.length > 0) {
    console.log("Installing development dependencies...")
    execSync(`npm install ${missing.join(" ")}`, { stdio: 'inherit' })
  }
}
```

#### Pros:
- ✅ **Significant download reduction**: 5-8MB vs 20-25MB for common commands
- ✅ **Single package**: No confusion, same installation method
- ✅ **Automatic resolution**: Heavy deps install when first needed
- ✅ **NPX cache friendly**: Cached after first use
- ✅ **Standard npm pattern**: Well-established approach
- ✅ **Zero breaking changes**: All commands work the same
- ✅ **Graceful degradation**: Clear error messages if deps missing

#### Cons:
- ❌ **First dev command slower**: One-time installation delay
- ❌ **Network required**: Need internet for on-demand installation
- ❌ **Complexity**: Runtime dependency checking logic

#### User Experience:
```bash
# Fast common case (5-8MB download)
npx @smithery/cli install my-server

# Slower first dev use (additional 15MB)  
npx @smithery/cli dev
# → "Installing development dependencies..."

# Fast subsequent use (cached)
npx @smithery/cli dev
```

### 2. Dynamic Imports Only

#### Implementation:
```typescript
// Load heavy deps only when needed
export async function dev() {
  const { buildMcpServer } = await import("../lib/build")
  const { startTunnel } = await import("../lib/tunnel")
}
```

#### Pros:
- ✅ **Faster startup**: Reduced memory usage for lightweight commands
- ✅ **Simple implementation**: Just change import statements
- ✅ **No breaking changes**: Everything still works

#### Cons:
- ❌ **Same download size**: Still downloads all 20-25MB
- ❌ **Limited benefit for NPX**: Download time unchanged
- ❌ **Memory only**: Helps startup time, not bandwidth

### 3. Separate Packages

#### Implementation:
```bash
npx @smithery/cli install          # Core package (~5MB)
npx @smithery/cli-dev dev          # Dev package (~20MB)
```

#### Pros:
- ✅ **Maximum optimization**: Each package only has needed deps
- ✅ **Clear separation**: Obvious what each package does

#### Cons:
- ❌ **User confusion**: Multiple packages to remember
- ❌ **Maintenance overhead**: Multiple repos/releases to manage
- ❌ **Breaking change**: Changes user installation commands
- ❌ **Discovery issues**: Users might not know about dev package

### 4. Peer Dependencies

#### Implementation:
```json
{
  "peerDependencies": {
    "esbuild": "^0.25.5",
    "@ngrok/ngrok": "^1.5.1"
  },
  "peerDependenciesMeta": {
    "esbuild": { "optional": true }
  }
}
```

#### Pros:
- ✅ **Minimal core package**: Very small download
- ✅ **User control**: Users choose what to install

#### Cons:
- ❌ **Poor UX**: Manual dependency management
- ❌ **Breaking changes**: Requires users to understand peer deps
- ❌ **Complex installation**: Multi-step process for dev features

### 5. External Binaries

#### Implementation:
Replace Node deps with system binaries:
- Use system `esbuild` binary instead of npm package
- Use `ngrok` CLI instead of `@ngrok/ngrok`

#### Pros:
- ✅ **Smallest package size**: No heavy Node deps
- ✅ **System integration**: Uses existing tools

#### Cons:
- ❌ **Platform complexity**: Different binaries per OS
- ❌ **Installation requirements**: Users must install tools separately
- ❌ **Version management**: Hard to ensure compatible versions
- ❌ **Error handling**: Complex failure scenarios

## Recommendation: Optional Dependencies

### Why This Approach Wins:

1. **Optimal for NPX usage**: 70% download reduction for most common use case
2. **Proven pattern**: Used by major packages like Next.js, Vite, esbuild itself
3. **Seamless UX**: Works exactly like current CLI, just faster
4. **Smart caching**: NPX cache means one-time cost for dev deps
5. **Future-proof**: Easy to move more deps to optional as needed

### Implementation Plan:

1. **Phase 1**: Move heavy deps to `optionalDependencies`
2. **Phase 2**: Add runtime dependency checker utility
3. **Phase 3**: Update dev/build/playground commands to use checker
4. **Phase 4**: Test with clean npm cache and various scenarios

### Expected Results:

| Command Type | Current Download | With Optional Deps | Improvement |
|--------------|------------------|-------------------|-------------|
| `install`, `list`, `uninstall` | 20-25MB | 5-8MB | **70% reduction** |
| `dev`, `build`, `playground` (first time) | 20-25MB | 5-8MB + 15MB | Same total |
| `dev`, `build`, `playground` (cached) | 20-25MB | 0MB (cached) | **100% reduction** |

This approach provides the best balance of download optimization, user experience, and implementation complexity.
