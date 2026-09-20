---
title: Configuration
description: The complete YAML and JSON configuration contract.
---

# Configuration

Almanac supports one static configuration file at the repository root:

- `almanac.yaml`
- `almanac.yml`
- `almanac.json`

Every top-level field is optional. Unknown keys and unsafe paths are rejected.

## Defaults

```yaml
include:
  - docs/**/*.md
  - apps/*/docs/**/*.md
  - packages/*/docs/**/*.md
exclude: []
targets:
  - path: AGENTS.md
    tags:
      start: <docs-index>
      end: </docs-index>
    format: flat
```

The target can normally use scalar shorthand:

```yaml
targets:
  - AGENTS.md
```

## `include`

An array of repository-relative POSIX globs. A file must match at least one pattern.

```yaml
include:
  - docs/**/*.md
  - decisions/**/*.md
```

The array cannot be empty. Absolute paths, Windows separators, and `..` traversal are invalid.

## `exclude`

An array of repository-relative POSIX globs removed from the included set. Exclusion always wins. Git-ignored paths are also excluded and cannot be opted back in.

```yaml
exclude:
  - docs/archive/**
  - '**/README.md'
```

## `targets`

An array of output files. Target paths must be unique, normalized literal POSIX paths. Glob and Git pathspec syntax are rejected.

```yaml
targets:
  - AGENTS.md
  - path: packages/sdk/AGENTS.md
    tags:
      start: <sdk-docs>
      end: </sdk-docs>
    format: flat
```

| Field    | Required | Default                          | Description                               |
| -------- | -------- | -------------------------------- | ----------------------------------------- |
| `path`   | yes      | none                             | Repository-relative instruction target    |
| `tags`   | no       | `<docs-index>` / `</docs-index>` | Exact full-line managed-block delimiters  |
| `format` | no       | `flat`                           | `flat` or an object containing `template` |

Tags must be non-empty, single-line, and different from each other.

## Validation

Configuration loading is eager. A malformed config fails before command handlers touch the repository. Almanac uses maltty's config middleware for discovery, parsing, defaults, validation, caching, and typed command context.
