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

Discovers documents, regenerates every configured target, writes changed files atomically, and stages only those changed targets. Missing or malformed managed tags are errors.

## `check`

```bash
almanac check [--format text|json]
```

Runs the same analysis as `sync` without writing or staging. Exits `1` when any target is stale and `0` when every target is current.

## `init`

```bash
almanac init [--hooks|--no-hooks]
```

Creates missing targets, adds empty managed blocks, generates the index, and stages changed targets. Interactive runs ask whether to install the optional pre-commit hook and default to No. Pass `--hooks` or `--no-hooks` to answer without prompting.

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
