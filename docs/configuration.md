---
title: Configuration
description: The complete YAML and JSON configuration contract.
---

# Configuration

Configuration files are optional. Use repeatable `--include`, `--exclude`, and `--target` flags with `init`, `index`, `sync`, or `check` for CLI-only operation. A provided flag replaces that complete field for the current invocation.

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
  path: AGENTS.md
  tags:
    start: <docs-index>
    end: </docs-index>
  format: flat
```

The common case uses scalar shorthand with no arrays or region wrapper:

```yaml
targets: AGENTS.md
```

## `include`

One repository-relative POSIX glob or an array of globs. A file must match at least one pattern at every configured level.

```yaml
include:
  - docs/**/*.md
  - decisions/**/*.md
```

An explicitly configured array cannot be empty. Absolute paths, Windows separators, and `..` traversal are invalid.

## `exclude`

One repository-relative POSIX glob or an array of globs removed from the included set. Exclusion always wins. Git-ignored paths are also excluded and cannot be opted back in.

```yaml
exclude:
  - docs/archive/**
  - '**/README.md'
```

## `targets`

One output file or an array of output files. Target paths must be unique, normalized literal POSIX paths. Glob and Git pathspec syntax are rejected. When one file needs multiple generated sections, configure one target with `regions`; duplicate target paths are rejected with that remediation.

```yaml
targets:
  - AGENTS.md
  - path: packages/sdk/AGENTS.md
    tags:
      start: <sdk-docs>
      end: </sdk-docs>
    format: flat
```

| Field     | Required | Default                          | Description                                         |
| --------- | -------- | -------------------------------- | --------------------------------------------------- |
| `path`    | yes      | none                             | Repository-relative instruction target              |
| `include` | no       | all                              | Globs that select from the discovered catalog       |
| `exclude` | no       | `[]`                             | Globs removed from this target's selected documents |
| `tags`    | no       | `<docs-index>` / `</docs-index>` | Exact full-line managed-region delimiters           |
| `format`  | no       | `flat`                           | `flat` or an object containing `template`           |

Tags must be non-empty, single-line, and different from each other.

`targets` accepts a scalar, one expanded target object, or an array. Use an array only for multiple output files. A target without `regions` is a flattened single region, so `include`, `exclude`, `tags`, and `format` apply directly to it.

## `regions`

A target can own one region object or an array of independently rendered regions. Almanac discovers the top-level document catalog once, narrows it with each region's `include` and `exclude` filters, renders every region, and atomically replaces the target file once. Omit `regions` entirely when the target's own `tags` and `format` describe the only region.

One explicit region does not need an array:

```yaml
targets:
  path: AGENTS.md
  regions:
    tags:
      start: <standards-index>
      end: </standards-index>
    include:
      - docs/standards/**
```

Use arrays only when the target contains multiple regions:

```yaml
include:
  - docs/**/*.md

targets:
  - path: AGENTS.md
    regions:
      - tags:
          start: <standards-index>
          end: </standards-index>
        include:
          - docs/standards/**
        format:
          template: |-
            Read every applicable standard before writing code.
            {% for document in documents %}
            {{ document.filePath }}: {{ document.title | default: document.fileName }}
            {% endfor %}

      - tags:
          start: <docs-index>
          end: </docs-index>
        exclude:
          - docs/standards/**
        format: flat
```

| Field     | Required | Default | Description                                               |
| --------- | -------- | ------- | --------------------------------------------------------- |
| `tags`    | yes      | none    | Exact full-line delimiters for this region                |
| `include` | no       | all     | Globs that select from the top-level discovered catalog   |
| `exclude` | no       | `[]`    | Globs removed from this region after its include filter   |
| `format`  | no       | `flat`  | `flat` or an object containing a Liquid `template` string |

Filters cascade from configuration to target to region. Includes are ORed within one level and ANDed across levels; excludes accumulate and always win. Every target and region filter is optional, and each accepts one glob or an array. Lower levels only narrow the top-level discovered catalog; they do not discover additional files. Tag lines must be unique across a target's regions. Nested, crossing, duplicate, missing, or reversed markers are rejected before Almanac writes or stages the target.

## Validation

Configuration loading is eager. A malformed config fails before command handlers touch the repository. This includes conflicting target paths and region tags. Almanac uses maltty's config middleware for discovery, parsing, defaults, validation, caching, and typed command context.
