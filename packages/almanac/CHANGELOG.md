# almanac-md

## 0.4.0

### Minor Changes

- c4cfa36: Add a typed `almanac-md/sdk` entry point for tools that supply their own configuration. SDK methods return plain values, throw on failure, and leave staging and hook installation opt-in.

  Update Zod to 4.6.7 to fix memory exhaustion when validating oversized constrained collections.

## 0.3.0

### Minor Changes

- 7e96fe7: Configure recursive compatibility links with Claude and Gemini provider presets, custom sibling filenames, or an empty list to disable link management.

### Patch Changes

- 55b592c: Replace the npm package's internal maintainer notes with a product-facing quick-start guide.

## 0.2.0

### Minor Changes

- fa2a68b: Support independently filtered and rendered managed regions within one target, with conflict validation and one atomic write and staging update per target.
- 4a3f435: Add CLI-only index filters and targets, standalone `index` and `link` commands, and recursive `CLAUDE.md` and `GEMINI.md` compatibility links for every Git-visible `AGENTS.md`.

## 0.1.0

### Minor Changes

- 2894c3b: Release the first public version of Almanac with deterministic, Git-aware documentation indexes, managed `AGENTS.md` blocks, repository hooks, and CI drift checks.

## 0.1.0-rc.0

### Minor Changes

- 2894c3b: Release the first public version of Almanac with deterministic, Git-aware documentation indexes, managed `AGENTS.md` blocks, repository hooks, and CI drift checks.
