import { describe, expect, it } from 'vitest'

import { createGitClient } from '#adapters/git.js'
import { createRepoPathResolver } from '#lib/repo-path.js'

import { createDocumentCatalog } from './documents.js'

const git = createGitClient(process.cwd())
if (!git.ok) {
  throw git.error
}

const catalog = createDocumentCatalog({
  config: { exclude: [], include: ['docs/**/*.md'], targets: [] },
  git: git.value,
  paths: createRepoPathResolver(process.cwd()),
})

describe('document catalog', () => {
  it('prefers frontmatter and normalizes Markdown', () => {
    const result = catalog.parse(
      'docs/auth.md',
      `---
title: Authentication
description: "How **tokens** move through the [system](/system)."
---
# Ignored heading

Ignored paragraph.
`,
    )
    expect(result).toEqual({
      error: null,
      ok: true,
      value: {
        description: 'How tokens move through the system.',
        fileName: 'auth.md',
        filePath: 'docs/auth.md',
        title: 'Authentication',
      },
    })
  })

  it('derives the heading and first prose paragraph after it', () => {
    const result = catalog.parse(
      'docs/deploy.md',
      `Preamble that is not selected.

# Deployments

- Skip this list.

Ship the service with \`pnpm deploy\` after approval.
`,
    )
    expect(result).toEqual({
      error: null,
      ok: true,
      value: {
        description: 'Ship the service with pnpm deploy after approval.',
        fileName: 'deploy.md',
        filePath: 'docs/deploy.md',
        title: 'Deployments',
      },
    })
  })

  it('rejects non-string metadata', () => {
    const result = catalog.parse('docs/bad.md', '---\ntitle: 42\n---\n')
    expect(result.ok).toBeFalsy()
    expect(result.error?.message).toContain('frontmatter title must be a string')
  })
})
