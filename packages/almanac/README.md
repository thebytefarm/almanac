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

## Documentation

- [Getting started](https://github.com/thebytefarm/almanac/blob/main/docs/getting-started.md)
- [Configuration](https://github.com/thebytefarm/almanac/blob/main/docs/configuration.md)
- [CLI reference](https://github.com/thebytefarm/almanac/blob/main/docs/cli.md)
- [Template guide](https://github.com/thebytefarm/almanac/blob/main/docs/templates.md)

## License

[MIT](https://github.com/thebytefarm/almanac/blob/main/LICENSE)
