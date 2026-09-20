<div align="center">
  <img src="public/logo.svg" alt="Almanac" width="90%" />
  <p><strong>A deterministic documentation index for coding agents. Keep AGENTS.md current without hand-maintaining it.</strong></p>

<a href="https://github.com/thebytefarm/almanac/actions/workflows/ci.yml"><img src="https://github.com/thebytefarm/almanac/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" /></a>
<a href="https://www.npmjs.com/package/almanac-md"><img src="https://img.shields.io/npm/v/almanac-md" alt="npm version" /></a>
<a href="https://github.com/thebytefarm/almanac/blob/main/LICENSE"><img src="https://img.shields.io/github/license/thebytefarm/almanac" alt="License" /></a>

<a href="docs/getting-started.md">Documentation</a> &nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp; <a href="https://github.com/thebytefarm/almanac/issues">Issues</a>

</div>

## Features

- 🔍 **Git-aware discovery:** Index tracked Markdown and exclude ignored files
- 🎯 **Deterministic output:** Produce stable, reviewable `AGENTS.md` updates
- 🛡️ **Managed boundaries:** Preserve every line outside Almanac's markers
- 🪝 **Repository hooks:** Refresh and stage changed indexes before a commit
- ✅ **CI enforcement:** Detect stale indexes without writing to the worktree

## Why

Agents do not need another generated repository overview. They need a small, current map to decisions, conventions, runbooks, and other knowledge they cannot infer from code. Almanac builds that map from the documentation already in the repository and keeps it current on every commit.

The design follows published evidence:

- [Vercel docs-index eval](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals): A compressed `AGENTS.md` index reached 100% where the no-docs baseline reached 53%.
- [ETH Zürich AGENTS.md study](https://arxiv.org/abs/2602.11988): Generated repository overviews did not improve task success and increased inference cost by over 20%.
- [Progressive-disclosure depth study](https://arxiv.org/abs/2607.17598): One routing layer helped across multiple documents; a second layer added no benefit and sometimes reduced accuracy.
- [Corpus2Skill](https://arxiv.org/abs/2604.14572): Visible corpus structure improved navigation for single-domain knowledge bases with recoverable taxonomies.
- [LlamaIndex filesystem benchmark](https://www.llamaindex.ai/blog/did-filesystem-tools-kill-vector-search): Filesystem agents beat RAG on correctness and relevance for small corpora, with RAG taking over at larger scales.

## Install

```bash
pnpm add -D almanac-md
```

## Usage

### Initialize the index

```bash
pnpm exec almanac init --hooks
```

`init` adds managed markers to `AGENTS.md` and installs a pre-commit hook that invokes the repository-pinned package. To initialize without installing the package or hook:

```bash
pnpm dlx almanac-md init --no-hooks
```

### Configure document discovery

Almanac reads `almanac.yaml`, `almanac.yml`, or `almanac.json` from the repository root. The default target is `AGENTS.md`.

```yaml
include:
  - docs/**/*.md
targets:
  - AGENTS.md
```

### Keep the index current

```bash
pnpm exec almanac sync   # update and stage changed indexes
pnpm exec almanac check  # fail when an index is stale
```

Use `check` in CI when hooks are not installed.

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

Read the [configuration reference](docs/configuration.md), [CLI reference](docs/cli.md), and [template guide](docs/templates.md) for the complete contract.

## License

[MIT](LICENSE)
