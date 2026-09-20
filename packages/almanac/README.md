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
| `almanac sync`          | Build every configured docs index, replace only managed blocks, and stage files Almanac changed.         |
| `almanac check`         | Run the same analysis without writing and fail when a managed block has drifted.                         |
| `almanac init`          | Add missing managed markers and ask whether to install the Git hook.                                     |
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
- `instructions`: find target `AGENTS.md` files and replace full-line-delimited markers.
- `git`: resolve repository state, ignored files, revisions, staging, and the effective hooks path.
- `hooks`: install, remove, and inspect a marked shell fragment without owning the rest of the hook.
- `diff`: compare instruction files after normalizing managed blocks away.

Commands should remain thin adapters over these capabilities. `sync` and `check` must share the exact analysis pipeline so CI cannot disagree with the writer.

## Configuration

Almanac's supported project configuration files are:

- `almanac.yaml`
- `almanac.yml`
- `almanac.json`

Use one file at the repository root. YAML and JSON are the public contract because static data keeps
configuration offline, deterministic, serializable, and safe to inspect in CI.

The schema is strict: unknown keys, absolute paths, parent traversal, duplicate target paths, empty
include or target lists, multiline tags, identical tags, and empty templates are errors. Every field
at the top level is optional because the schema applies the defaults from `VISION.md`.

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

The normal form uses the scalar target shorthand:

```yaml
targets:
  - AGENTS.md
```

It expands to the target shown above. Expanded targets can override tags and choose either the flat
format or a custom Liquid template:

```yaml
targets:
  - AGENTS.md
  - path: packages/sdk/AGENTS.md
    tags:
      start: <sdk-docs>
      end: </sdk-docs>
    format:
      template: |
        {% for document in documents %}
        {{ document.filePath }}: {{ document.description }}
        {% endfor %}
```

`include` and `exclude` are repository-relative glob arrays. A document must match at least one
include glob and no exclude glob; exclude always wins. Git-ignored files remain excluded regardless
of configuration.

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
3. Replace the managed block with a stable sentinel in both versions.
4. Compare the remaining human-owned content and managed-block position.
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
