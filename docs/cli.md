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

Discovers documents, regenerates every configured region, atomically replaces each changed target once, and recursively creates configured compatibility links beside every Git-visible `AGENTS.md`. Links default to `CLAUDE.md -> AGENTS.md` and `GEMINI.md -> AGENTS.md`. Changed managed paths are staged. Missing, malformed, conflicting, or overlapping regions and conflicting link paths are errors.

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

Recursively discovers every Git-visible `AGENTS.md` and creates its configured sibling links. It does not modify index blocks, and configuration is optional. Existing conflicting paths stop the command with remediation instructions. Set `links: []` to disable link management.

## `check`

```bash
almanac check [--format text|json]
```

Validates the complete configuration, then runs the same analysis as `sync` without writing or staging. Invalid configuration exits `2`, stale targets or compatibility links exit `1`, and a current repository exits `0`. Validation errors identify the failing configuration path and explain conflicts such as duplicate targets or region tags.

## `init`

```bash
almanac init [--hooks|--no-hooks]
```

Creates missing targets, adds empty managed blocks, generates the index, recursively creates configured links beside each Git-visible `AGENTS.md`, and stages changed paths. Interactive runs ask whether to install the optional pre-commit hook and default to No. Pass `--hooks` or `--no-hooks` to answer without prompting.

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

Reads each configured target from both Git revisions, normalizes every managed region, and classifies changes:

| Classification   | Meaning                                 | Exit |
| ---------------- | --------------------------------------- | ---- |
| `none`           | Target files are byte-for-byte equal    | `0`  |
| `generated-only` | Only managed region content changed     | `0`  |
| `human-authored` | Content outside managed regions changed | `1`  |

Unreadable revisions and invalid tags are operational errors.
