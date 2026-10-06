# Almanac CLI

This package provides the `almanac` binary and the deterministic indexing engine behind it.

## Install

```bash
pnpm add -D almanac-md
pnpm exec almanac init
```

The interactive setup asks whether to install Git hooks and defaults to No. Run `pnpm exec almanac hooks install` or initialize with `pnpm exec almanac init --hooks` when commits should refresh the managed index automatically. Pass `--no-hooks` for non-interactive setup without a hook.

## Command Surface

| Command                 | Contract                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `almanac sync`          | Build indexes, maintain recursive compatibility aliases, and stage managed paths.                        |
| `almanac index`         | Build and stage configured indexes without managing compatibility links.                                 |
| `almanac link`          | Recursively create and stage Claude and Gemini compatibility links without indexing.                     |
| `almanac check`         | Run the same analysis without writing and fail when a managed path has drifted.                          |
| `almanac init`          | Add missing markers and aliases, then ask whether to install the Git hook.                               |
| `almanac hooks install` | Idempotently add Almanac's marked section to the effective Git pre-commit hook.                          |
| `almanac hooks remove`  | Remove only Almanac's marked section and leave the rest of the hook intact.                              |
| `almanac hooks status`  | Report whether the effective pre-commit hook contains the current Almanac section.                       |
| `almanac diff`          | Classify `AGENTS.md` changes between two Git revisions as `none`, `generated-only`, or `human-authored`. |

`diff` is a policy primitive, not a policy engine. CI can use its JSON output or exit status to require a human reviewer, run a larger suite, or block a merge. Almanac should not contain GitHub-specific approval rules.

## Boundaries

The implementation should be split by capability rather than by command:

- `config`: discover and validate static configuration.
- `documents`: discover Markdown through Git-aware file selection and derive descriptions.
- `index`: render and compare deterministic managed blocks.
- `instructions`: update target `AGENTS.md` blocks and maintain recursive agent compatibility aliases.
- `git`: resolve repository state, ignored files, revisions, staging, and the effective hooks path.
- `hooks`: install, remove, and inspect a marked shell fragment without owning the rest of the hook.
- `diff`: compare instruction files after normalizing managed blocks away.

Commands should remain thin adapters over these capabilities. `sync` and `check` must share the exact analysis pipeline so CI cannot disagree with the writer.

Configuration files are optional. `init`, `index`, `sync`, and `check` accept repeatable `--include`, `--exclude`, and `--target` flags that override the corresponding configured or default values for one invocation. `link` needs no configuration or filters.

## Configuration

Almanac's supported project configuration files are:

- `almanac.yaml`
- `almanac.yml`
- `almanac.json`

Use one file at the repository root. YAML and JSON are the public contract because static data keeps
configuration offline, deterministic, serializable, and safe to inspect in CI.

The schema is strict: unknown keys, absolute paths, parent traversal, duplicate target paths, empty
include or target lists, conflicting or overlapping region tags, and empty templates are errors.
Every field at the top level is optional because the schema applies Almanac's documented defaults.

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
```

The normal form uses the scalar target shorthand without an array:

```yaml
targets: AGENTS.md
```

It expands to the target shown above. Expanded targets can filter the discovered catalog, override
tags, and provide a custom Liquid template:

```yaml
targets:
  - AGENTS.md
  - path: packages/sdk/AGENTS.md
    tags:
      start: <sdk-docs>
      end: </sdk-docs>
    template: |
      {% for document in documents %}
      {{ document.filePath }}: {{ document.description }}
      {% endfor %}
```

`include` and `exclude` accept one repository-relative glob or an array. Filters cascade from the
configuration to the target to the region. Includes are ORed within a level and ANDed across levels;
excludes accumulate and always win. Git-ignored files remain excluded regardless of configuration.

A target can define multiple independently filtered and rendered regions. Almanac renders all regions
in memory, atomically replaces the target file once, and stages the target once:

```yaml
targets:
  - path: AGENTS.md
    regions:
      - tags:
          start: <standards-index>
          end: </standards-index>
        include:
          - docs/standards/**
      - tags:
          start: <docs-index>
          end: </docs-index>
        exclude:
          - docs/standards/**
```

Region filters narrow the top-level discovered catalog. Every marker line must be unique within its
target, and managed regions must not overlap. Both `targets` and `regions` accept one value or an
array; arrays are only required when configuring multiple values.

Omit `template` to use Almanac's built-in renderer. Set it directly on a target or region only when
custom Liquid output is required.
Run `almanac check` to validate configuration and output without changing the repository. Invalid
configuration exits `2`, stale output exits `1`, and current output exits `0`.

Liquid receives a `documents` array with this stable shape:

```ts
interface TemplateDocument {
  readonly filePath: string
  readonly fileName: string
  readonly title?: string
  readonly description?: string
}
```

`filePath` is always the actual repository-relative path. `title` comes from frontmatter or the first
Markdown heading. `description` comes from frontmatter or the first prose paragraph after the first
heading, falling back to the first prose paragraph anywhere. Both inferred values are normalized to
plain, single-line text and may be absent.

Almanac uses maltty's config middleware for discovery, parsing, validation, defaults, caching, and
typed command context. Maltty `1.0.0-rc.4` can technically discover additional long-form executable
formats such as `almanac.config.ts`; those formats are inherited framework behavior and are not
supported or documented by Almanac.

## Git Hooks

Hook installation must preserve existing tooling:

- Resolve the effective hooks directory, including repository-local `core.hooksPath`, while refusing shared directories outside the repository or Git common directory.
- Create `pre-commit` only when it does not exist.
- Otherwise insert a fail-closed shell fragment between Almanac-specific start and end markers after a supported shell shebang.
- Refuse non-shell hooks rather than corrupting Node, Python, or other executable formats.
- Refuse CRLF shell hooks that Unix cannot execute reliably.
- Refuse malformed or duplicate markers rather than rewriting an ambiguous hook.
- Preserve unrelated content and the executable bit using atomic writes.
- Make install and remove idempotent, and repair stale managed commands.
- Detect the repository package manager and have the fragment run its local-binary form, such as
  `pnpm exec almanac sync || exit $?`; Git hooks cannot assume `node_modules/.bin` is on `PATH`.
- Have `sync` stage only files it actually changed.

Hooks are opt-in. Pass `almanac init --hooks` during initialization or run `almanac hooks install` later. Hook removal never removes markers from `AGENTS.md`; those are committed project data and require an explicit future command if cleanup is needed.

## Diff Contract

`almanac diff --base <revision> --head <revision> --format json` should:

1. Load each configured instruction target at both revisions.
2. Validate managed markers at both revisions.
3. Replace every managed region with a stable sentinel in both versions.
4. Compare the remaining human-owned content and managed-region positions.
5. Emit one record per target and a repository-level classification.

The command exits `0` for `none` and `generated-only`, and `1` for `human-authored`. Invalid markers, unreadable revisions, and Git failures are operational errors and should use a distinct exit code.

Example JSON shape:

```json
{
  "classification": "human-authored",
  "targets": [
    {
      "path": "AGENTS.md",
      "classification": "human-authored"
    }
  ]
}
```
