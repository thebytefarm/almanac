# Almanac

Almanac keeps repository documentation discoverable to coding agents through a deterministic, Git-aware index. It finds tracked Markdown files, derives short descriptions, and updates managed blocks in `AGENTS.md` without touching human-authored content.

## Install

```bash
pnpm add -D almanac-md
pnpm exec almanac init
```

`init` adds the managed index and asks whether Almanac should install its pre-commit hook. The hook is optional. CI can enforce the same state without installing it:

```bash
pnpm exec almanac check
```

## Commands

| Command                 | Purpose                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `almanac sync`          | Update configured indexes and stage files changed by Almanac.    |
| `almanac check`         | Fail when a managed index is out of date without writing files.  |
| `almanac init`          | Add missing managed markers and optionally install the Git hook. |
| `almanac hooks install` | Add Almanac to the repository's effective pre-commit hook.       |
| `almanac hooks remove`  | Remove Almanac's section while preserving the rest of the hook.  |
| `almanac hooks status`  | Report whether the current Almanac hook is installed.            |
| `almanac diff`          | Classify index changes as generated or human-authored.           |

See the [getting started guide](docs/getting-started.md), [configuration reference](docs/configuration.md), and [CLI reference](docs/cli.md) for the complete contract.

## Configuration

Almanac reads `almanac.yaml`, `almanac.yml`, or `almanac.json` from the repository root. The default target is `AGENTS.md`.

```yaml
include:
  - docs/**/*.md
targets:
  - AGENTS.md
```

The index is bounded by managed markers. Content outside those markers remains yours.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Security reports belong in a private GitHub advisory as described in [SECURITY.md](SECURITY.md).

## License

Almanac is available under the [MIT License](LICENSE).
