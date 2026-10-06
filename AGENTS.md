# Almanac

Almanac keeps repository documentation discoverable to coding agents through a deterministic, Git-aware index.

## Working Agreement

- Use `pnpm` and run commands from the repository root.
- Run `pnpm validate` before declaring work complete.
- Keep command handlers thin and put behavior in functional, repository-scoped services.
- Preserve human-authored content outside Almanac's managed markers.

# Documentation Index

<docs-index>

docs/cli.md: Commands, options, output, and exit behavior.
docs/configuration.md: The complete YAML and JSON configuration contract.
docs/getting-started.md: Install Almanac, initialize the managed index, and verify the repository.
docs/how-it-works.md: The indexing pipeline, managed-block rules, and intentional limits.
docs/templates.md: Build a custom index using the stable document object.

</docs-index>

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
