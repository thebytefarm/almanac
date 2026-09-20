# Contributing to Almanac

Almanac accepts focused bug fixes, documentation improvements, and features that preserve its deterministic and repository-scoped behavior.

## Prerequisites

- Node.js 26 or newer
- pnpm 12.3.4 through Corepack
- Git

## Setup

```bash
corepack enable
pnpm install
pnpm validate
```

Run commands from the repository root. Unit tests live beside source files under `packages/almanac/src`; integration tests live under `packages/almanac/tests`.

## Pull requests

1. Create a branch from `main` using `<type>/<short-description>`.
2. Keep the pull request to one logical change.
3. Add tests for behavior that can regress.
4. Run `pnpm validate`.
5. Use a Conventional Commit title such as `fix(cli): preserve existing hook content`.

Changes to `repo-almanac` need a changeset:

```bash
pnpm changeset
```

Choose `patch` for compatible fixes, `minor` for compatible features, and `major` for breaking changes. Documentation, CI, and repository-only maintenance usually do not need one.

## Design constraints

- Keep command handlers thin. Put behavior in functional, repository-scoped services.
- Return typed results for predictable failures instead of throwing inside core behavior.
- Preserve human-authored content outside Almanac's managed markers.
- Exercise real Git repositories and filesystems in integration tests.

Contributions are licensed under the [MIT License](LICENSE).
