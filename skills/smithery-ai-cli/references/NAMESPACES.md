# Namespaces

Namespaces organize your servers and connections (similar to kubectl contexts).

## List Namespaces

```bash
smithery namespace list
```

Shows all namespaces you have access to.

## Show Current Namespace

```bash
smithery namespace show
```

Displays the currently active namespace.

## Set Current Namespace

```bash
smithery namespace use my-namespace
```

All subsequent commands will use this namespace by default.

## Create a Namespace

```bash
smithery namespace create my-new-namespace
```

Creates and claims a new namespace.

## Namespace Context

Most commands accept a `--namespace` flag to override the current context:

```bash
smithery mcp list --namespace other-namespace
```

## How Namespaces Work

- Each user can have multiple namespaces
- Namespaces contain servers and connections
- First-time users get a namespace auto-created
- Namespace names must be unique globally

## Example Workflow

```bash
# Check current namespace
smithery namespace show

# List available namespaces
smithery namespace list

# Switch to a different namespace
smithery namespace use production

# Create a new namespace for testing
smithery namespace create my-testing

# Use the new namespace
smithery namespace use my-testing
```
