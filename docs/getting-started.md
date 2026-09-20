---
title: Getting Started
description: Install Almanac, initialize the managed index, and verify the repository.
---

# Getting Started

Almanac needs Node 26 or newer and a Git repository.

## Install

Install the CLI as a development dependency:

```bash
pnpm add -D repo-almanac
```

## Initialize

Run Almanac from the repository root:

```bash
pnpm exec almanac init
```

The setup workflow asks whether to install Almanac's optional pre-commit hook. The default answer is No.

`init` performs two operations:

1. Creates `AGENTS.md` when it does not exist, or adds the managed tags to the existing file.
2. Generates the first document index and stages `AGENTS.md`.

Git hooks are optional. Opt in when you want every commit to refresh the index:

```bash
pnpm exec almanac hooks install
```

You can also install the hook during initialization with `pnpm exec almanac init --hooks`. For non-interactive initialization without a hook, pass `--no-hooks`.

## Add a document

The zero-config defaults discover Markdown under `docs/`, `apps/*/docs/`, and `packages/*/docs/`.

```markdown
---
title: Authentication
description: Token lifecycle and refresh semantics.
---

# Authentication
```

Regenerate the index at any time:

```bash
pnpm exec almanac sync
```

`sync` stages only changed target files. It does not stage source documents or unrelated changes.

## Check in CI

Use `check` to detect drift without writing files:

```bash
pnpm exec almanac check
```

The command exits with status `1` when a target is stale. For machine-readable output, pass `--format json`.

## Next steps

- [How It Works](/how-it-works) explains the generation pipeline and ownership boundary.
- [Configuration](/configuration) changes discovery, targets, tags, and output format.
- [CLI Reference](/cli) lists every command and exit contract.
