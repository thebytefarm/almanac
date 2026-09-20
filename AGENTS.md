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
