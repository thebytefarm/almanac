---
title: CLI Reference
description: Commands, options, output, and exit behavior.
---

# CLI Reference

Run commands from a Git repository. The global `--cwd <path>` option changes the working directory before command execution.

## `sync`

```bash
almanac sync
```

Discovers documents, regenerates every configured target, and recursively creates sibling `CLAUDE.md -> AGENTS.md` and `GEMINI.md -> AGENTS.md` compatibility links. Changed managed paths are staged. Missing or malformed tags and conflicting alias paths are errors.

`init`, `sync`, `index`, and `check` accept repeatable CLI overrides:

```bash
almanac sync \
  --include 'docs/**/*.md' \
  --include 'packages/*/guides/**/*.md' \
  --exclude 'docs/archive/**' \
  --target AGENTS.md
```

Provided flags replace that field from the optional config file or zero-config defaults for the current invocation.

## `index`

```bash
almanac index [--include <glob>] [--exclude <glob>] [--target <path>]
```

Regenerates and stages index targets without creating or validating agent compatibility links.

## `link`

```bash
almanac link
```

Recursively discovers every Git-visible `AGENTS.md` and creates sibling `CLAUDE.md -> AGENTS.md` and `GEMINI.md -> AGENTS.md` links. It needs no configuration and does not modify index blocks. Existing conflicting paths stop the command with remediation instructions.

## `check`

```bash
almanac check [--format text|json]
```

Runs the same analysis as `sync` without writing or staging. Exits `1` when any target or compatibility link is stale and `0` when every managed path is current.

## `init`

```bash
almanac init [--hooks|--no-hooks]
```

Creates missing targets, adds empty managed blocks, generates the index, recursively links `CLAUDE.md` and `GEMINI.md` to each Git-visible `AGENTS.md`, and stages changed paths. Interactive runs ask whether to install the optional pre-commit hook and default to No. Pass `--hooks` or `--no-hooks` to answer without prompting.

## `hooks install`

```bash
almanac hooks install
```

Adds an idempotent marked fragment after an existing shebang. The fragment invokes the local binary through pnpm, npm, Yarn, or Bun based on repository metadata.

## `hooks remove`

```bash
almanac hooks remove
```

Removes only Almanac's marked fragment. Other hook commands and comments remain untouched.

## `hooks status`

```bash
almanac hooks status [--format text|json]
```

Reports `installed`, `not-installed`, or `malformed` with the effective hook path. A malformed fragment exits non-zero.

## `diff`

```bash
almanac diff --base <revision> [--head HEAD] [--format text|json]
```

Reads each configured target from both Git revisions, removes the managed block, and classifies changes:

| Classification   | Meaning                                 | Exit |
| ---------------- | --------------------------------------- | ---- |
| `none`           | Target files are byte-for-byte equal    | `0`  |
| `generated-only` | Only managed block content changed      | `0`  |
| `human-authored` | Content outside a managed block changed | `1`  |

Unreadable revisions and invalid tags are operational errors.
