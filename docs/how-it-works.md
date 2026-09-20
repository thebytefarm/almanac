---
title: How It Works
description: The indexing pipeline, managed-block rules, and intentional limits.
---

# How It Works

Almanac generates pointers to repository documentation inside an instruction file coding agents already load. It does not retrieve content, summarize the codebase, or run a server.

## Generation pipeline

Every `sync` and `check` invocation uses the same pipeline:

1. Resolve the Git repository and validated static configuration.
2. Discover files matching `include` and reject matches from `exclude` or `.gitignore`.
3. Derive each document's title and one-line description.
4. Sort documents by repository-relative path.
5. Render each target as flat lines or a Liquid template.
6. Replace only the content between that target's exact full-line tags.

`check` stops there and reports drift. `sync` writes changed targets atomically and stages those targets with `git add -- <paths>`.

## Metadata derivation

Titles use the first available source:

1. Frontmatter `title`.
2. First Markdown heading.
3. No title.

Descriptions use the first available source:

1. Frontmatter `description`.
2. First prose paragraph after the first heading.
3. First prose paragraph anywhere in the document.
4. No description.

Markdown formatting is removed, whitespace is collapsed, and descriptions are bounded internally. Flat output falls back from description to title to filename, so every discovered document has a useful label.

## Ownership boundary

Humans own everything outside the configured tags. Almanac owns the complete block, including blank lines inside it.

```markdown
# Repository instructions

Human-authored rules stay here.

<docs-index>

docs/auth.md: Token lifecycle and refresh semantics.

</docs-index>
```

Tags must each occur exactly once and on their own lines. Missing, duplicate, or reversed tags stop the command instead of risking a destructive rewrite.

## Git awareness

Almanac asks Git which discovered paths are ignored before reading them. Local notes, generated Markdown, and secret material excluded by `.gitignore` cannot leak into a committed index.

Optional hook installation resolves repository-local `core.hooksPath`, detects the repository package manager, preserves existing shell content, and atomically inserts one idempotent fail-closed fragment. Shared external hook directories, non-shell hooks, and CRLF shell hooks are rejected rather than rewritten.

## Intentional limits

Almanac is for a bounded, single-domain documentation tree: tens to low hundreds of documents. It is not code search, semantic retrieval, a vector database, or a replacement for documentation quality. A weak source description produces a weak index line.
