# Agent Resources Directory

This directory contains specialized guides for working with the Smithery CLI codebase. Each guide focuses on a specific area of functionality.

## Available Guides

### Adding New Clients
**File**: `agents/adding_new_clients.md`

Complete guide for adding new AI client configurations to the Smithery CLI. Covers:
- Client configuration structure and types
- Step-by-step implementation process
- Examples for different client types (JSON, YAML, TOML, command-based)
- Testing requirements and matrix coverage
- Platform-specific path handling

**Use when**: Adding support for new AI clients (Claude variants, VS Code, Cursor, etc.)

### Publishing Workflow  
**File**: `agents/publish_workflow.md`

Comprehensive guide for the automated npm publishing system. Covers:
- Tag-based publishing workflow
- GitHub Actions configuration
- Security and reliability features
- Step-by-step publishing process
- Troubleshooting common issues
- Integration with development workflow

**Use when**: Publishing new versions, troubleshooting releases, or understanding the CI/CD pipeline

## Guide Selection Rules

**For AI Agents**: Always refer to the appropriate specialized guide rather than attempting to provide generic advice. Each guide contains:
- Complete implementation details
- Working code examples  
- Testing requirements
- Best practices
- Troubleshooting steps

**For Contributors**: These guides serve as the authoritative reference for their respective areas. Follow the patterns and practices documented in each guide.

## Adding New Guides

When adding new specialized guides:
1. Create the guide in the `agents/` directory
2. Use descriptive filenames (e.g., `database_migrations.md`)
3. Update this index with a brief description
4. Include practical examples and troubleshooting sections
5. Test all code examples before documenting
