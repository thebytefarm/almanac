# Almanac

A deterministic documentation index for coding agents. Almanac keeps `AGENTS.md` current without hand-maintaining it.

## Install

```bash
pnpm add -D almanac-md
```

## Quick start

Initialize Almanac and install its optional pre-commit hook:

```bash
pnpm exec almanac init --hooks
```

`init` adds managed markers to `AGENTS.md`, builds the first documentation index, and creates configured compatibility links. Links default to `CLAUDE.md -> AGENTS.md` and `GEMINI.md -> AGENTS.md`. Existing files are never replaced.

Use `--no-hooks` when you do not want the Git hook:

```bash
pnpm exec almanac init --no-hooks
```

## Configuration

Almanac reads `almanac.yaml`, `almanac.yml`, or `almanac.json` from the repository root. Every field is optional.

```yaml
include:
  - docs/**/*.md
links: [claude, gemini]
targets:
  - AGENTS.md
```

Set `links` to one provider preset, mix presets with custom sibling filenames, or use `links: []` to disable compatibility links.

## Commands

| Command                 | Purpose                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| `almanac sync`          | Update indexes and recursive compatibility links, then stage them.  |
| `almanac index`         | Update and stage indexes without creating compatibility links.      |
| `almanac link`          | Recursively create and stage agent compatibility links.             |
| `almanac check`         | Fail when a managed index or compatibility link is out of date.     |
| `almanac init`          | Add markers and compatibility links, then optionally install hooks. |
| `almanac hooks install` | Add Almanac to the repository's effective pre-commit hook.          |
| `almanac hooks remove`  | Remove Almanac's section while preserving the rest of the hook.     |
| `almanac hooks status`  | Report whether the current Almanac hook is installed.               |
| `almanac diff`          | Classify index changes as generated or human-authored.              |

## SDK

Embed Almanac in a Node.js tool with your own configuration:

```ts
import { createAlmanac } from 'almanac-md/sdk'
import type { AlmanacConfigInput } from 'almanac-md/sdk'

const config: AlmanacConfigInput = {
  include: ['docs/**/*.md'],
  links: [],
  targets: ['AGENTS.md'],
}

const almanac = createAlmanac({ cwd: repoPath, config })
await almanac.initialize()
const changes = await almanac.sync()
```

`config` is required; `{}` uses Almanac's defaults. The SDK validates it but never reads Almanac config files. `cwd` defaults to the current directory and discovers the containing Git repository. Node.js 26+ and Git are required.

Methods return plain values and reject with Errors on failure; client creation throws for invalid config or a missing repository. No Result wrapper, CLI output, or process exit handling is required.

| Method                                                | Behavior                                                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `check()`                                             | Return `{ path, changed }` entries for indexes and links without writing. Drift is data, not an exception. |
| `index(options?)`                                     | Update configured index regions without creating links.                                                    |
| `sync(options?)`                                      | Update configured index regions and compatibility links.                                                   |
| `link(options?)`                                      | Create configured compatibility links next to Git-visible `AGENTS.md` files.                               |
| `initialize(options?)`                                | Create missing targets/markers, then sync.                                                                 |
| `diff(base, head)`                                    | Return generated versus human-authored change classifications.                                             |
| `hooks.install()`, `hooks.remove()`, `hooks.status()` | Explicitly manage or inspect the repository hook.                                                          |

Writes do not stage changes unless you pass `{ stage: true }`. `initialize()` does not install hooks unless you pass `{ hooks: true }`. The CLI keeps its existing staging behavior.

Content outside configured markers is preserved. Conflicting aliases and symlink targets are rejected. Writes are atomic per target, not transactional across files; concurrent edits are not protected. Coordinate access to the repository in your host tool. Installed hooks invoke the CLI and therefore use repository Almanac config, not your in-memory SDK config.

## Documentation

- [Getting started](https://github.com/thebytefarm/almanac/blob/main/docs/getting-started.md)
- [Configuration](https://github.com/thebytefarm/almanac/blob/main/docs/configuration.md)
- [CLI reference](https://github.com/thebytefarm/almanac/blob/main/docs/cli.md)
- [Template guide](https://github.com/thebytefarm/almanac/blob/main/docs/templates.md)

## License

[MIT](https://github.com/thebytefarm/almanac/blob/main/LICENSE)
