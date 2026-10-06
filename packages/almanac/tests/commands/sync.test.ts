import { lstat, readlink, symlink } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { invoke, setup } from '../cli.js'

describe('sync command', () => {
  it('creates and stages recursive compatibility aliases', async () => {
    const fixture = await setup({
      'AGENTS.md': '<docs-index>\n</docs-index>\n',
      'packages/api/AGENTS.md': '# API instructions\n',
    })
    await fixture.commit('initial instructions')

    const result = await invoke('sync')

    expect(result.error).toBeUndefined()
    expect((await lstat(join(fixture.path, 'CLAUDE.md'))).isSymbolicLink()).toBeTruthy()
    expect(await readlink(join(fixture.path, 'CLAUDE.md'))).toBe('AGENTS.md')
    expect(await readlink(join(fixture.path, 'GEMINI.md'))).toBe('AGENTS.md')
    expect(await readlink(join(fixture.path, 'packages/api/CLAUDE.md'))).toBe('AGENTS.md')
    expect(await readlink(join(fixture.path, 'packages/api/GEMINI.md'))).toBe('AGENTS.md')
    expect(await fixture.git('diff', '--cached', '--name-only')).toBe(
      'CLAUDE.md\nGEMINI.md\npackages/api/CLAUDE.md\npackages/api/GEMINI.md',
    )
  })

  it('leaves correct compatibility aliases unchanged', async () => {
    const fixture = await setup({
      'AGENTS.md': '<docs-index>\n</docs-index>\n',
    })
    await symlink('AGENTS.md', join(fixture.path, 'CLAUDE.md'))
    await symlink('AGENTS.md', join(fixture.path, 'GEMINI.md'))
    await fixture.commit('initial instructions')

    const result = await invoke('sync')

    expect(result.error).toBeUndefined()
    expect(await fixture.git('diff', '--cached', '--name-only')).toBe('')
  })

  it('rejects conflicting Claude compatibility paths without replacing them', async () => {
    const fixture = await setup({
      'AGENTS.md': '<docs-index>\nold\n</docs-index>\n',
      'CLAUDE.md': '# Claude-specific instructions\n',
      'docs/guide.md': '# Guide\n\nNew guidance.\n',
    })
    const before = await fixture.read('AGENTS.md')

    const result = await invoke('sync')

    expect(result.exitCode).toBe(2)
    expect(await fixture.read('AGENTS.md')).toBe(before)
    expect(await fixture.read('CLAUDE.md')).toBe('# Claude-specific instructions\n')
  })

  it('rejects Claude compatibility links with a different target', async () => {
    const fixture = await setup({
      'AGENTS.md': '<docs-index>\n</docs-index>\n',
      'OTHER.md': '# Other instructions\n',
    })
    await symlink('OTHER.md', join(fixture.path, 'CLAUDE.md'))

    const result = await invoke('sync')

    expect(result.exitCode).toBe(2)
    expect(await readlink(join(fixture.path, 'CLAUDE.md'))).toBe('OTHER.md')
  })

  it('syncs discovered docs and stages only the target', async () => {
    const fixture = await setup({
      'AGENTS.md': '# Instructions\n\n<docs-index>\n</docs-index>\n',
      'docs/auth.md': '# Authentication\n\nToken lifecycle and refresh semantics.\n',
      'docs/private.md': '# Private\n\nDo not index this.\n',
      '.gitignore': 'docs/private.md\n',
    })

    const result = await invoke('sync')

    expect(result.error).toBeUndefined()
    expect(result.exitCode).toBeUndefined()
    expect(await fixture.read('AGENTS.md')).toContain(
      'docs/auth.md: Token lifecycle and refresh semantics.',
    )
    expect(await fixture.read('AGENTS.md')).not.toContain('private.md')
    expect(await fixture.git('diff', '--cached', '--name-only')).toBe(
      'AGENTS.md\nCLAUDE.md\nGEMINI.md',
    )
  })

  it('stages managed output without capturing unstaged human edits', async () => {
    const fixture = await setup({
      'AGENTS.md': '# Instructions\n\n<docs-index>\n</docs-index>\n',
      'docs/auth.md': '# Authentication\n\nInitial guidance.\n',
    })
    await invoke('sync')
    await fixture.commit('initial index')
    await fixture.write(
      'AGENTS.md',
      (await fixture.read('AGENTS.md')).replace('# Instructions', '# Local instructions'),
    )
    await fixture.write('docs/auth.md', '# Authentication\n\nUpdated guidance.\n')

    const result = await invoke('sync')

    expect(result.error).toBeUndefined()
    expect(await fixture.read('AGENTS.md')).toContain('# Local instructions')
    const indexed = await fixture.git('show', ':AGENTS.md')
    expect(indexed).toContain('# Instructions')
    expect(indexed).not.toContain('# Local instructions')
    expect(indexed).toContain('Updated guidance.')
  })

  it('loads project configuration from the Git root when invoked below it', async () => {
    const fixture = await setup({
      'AGENTS.md': '<docs-index>\n</docs-index>\n',
      'docs/guide.md': '# Guide\n\nNested invocation.\n',
    })
    process.chdir(join(fixture.path, 'docs'))

    const result = await invoke('sync')

    expect(result.error).toBeUndefined()
    expect(await fixture.read('AGENTS.md')).toContain('Nested invocation.')
  })

  it('loads YAML config and renders a custom Liquid target', async () => {
    const fixture = await setup({
      'INDEX.md': '<catalog>\n</catalog>\n',
      'knowledge/a.md': '---\ntitle: Alpha\n---\n\nAlpha details.\n',
      'almanac.yaml': `include:
  - knowledge/**/*.md
targets:
  - path: INDEX.md
    tags:
      start: <catalog>
      end: </catalog>
    format:
      template: |-
        {% for document in documents %}* {{ document.title }} -> {{ document.filePath }}{% endfor %}
`,
    })

    const result = await invoke('sync')

    expect(result.error).toBeUndefined()
    expect(await fixture.read('INDEX.md')).toContain('* Alpha -> knowledge/a.md')
  })

  it('filters and renders multiple regions in one atomic target update', async () => {
    const fixture = await setup({
      'AGENTS.md': `# Instructions

<standards-index>
old standards
</standards-index>

Human-authored rule.

<docs-index>
old docs
</docs-index>
`,
      'almanac.yaml': `include:
  - docs/**/*.md
targets:
  - path: AGENTS.md
    regions:
      - tags:
          start: <standards-index>
          end: </standards-index>
        include:
          - docs/standards/**
        format:
          template: |-
            Read every applicable standard before writing code.
            {% for document in documents %}{{ document.filePath }}: {{ document.title }}{% endfor %}
      - tags:
          start: <docs-index>
          end: </docs-index>
        exclude:
          - docs/standards/**
        format: flat
`,
      'docs/guide.md': '# Guide\n\nGeneral guidance.\n',
      'docs/standards/typescript.md': '# TypeScript\n\nTypeScript rules.\n',
    })

    const result = await invoke('sync')

    expect(result.error).toBeUndefined()
    const output = await fixture.read('AGENTS.md')
    expect(output).toContain('Read every applicable standard before writing code.')
    expect(output).toContain('docs/standards/typescript.md: TypeScript')
    expect(output).toContain('docs/guide.md: General guidance.')
    expect(output.match(/docs\/standards\/typescript\.md/gu)).toHaveLength(1)
    expect(output).toContain('Human-authored rule.')
    expect(await fixture.git('diff', '--cached', '--name-only')).toBe(
      'AGENTS.md\nCLAUDE.md\nGEMINI.md',
    )
  })

  it('stacks catalog, target, and region filters', async () => {
    const fixture = await setup({
      'AGENTS.md': '<standards-index>\nold\n</standards-index>\n',
      'almanac.yaml': `include: docs/**/*.md
exclude: docs/global-archive/**/*.md
targets:
  path: AGENTS.md
  include: docs/team/**/*.md
  exclude: docs/team/drafts/**/*.md
  regions:
    tags:
      start: <standards-index>
      end: </standards-index>
    include: docs/team/standards/**/*.md
    exclude: docs/team/standards/archive/**/*.md
`,
      'docs/global-archive/hidden.md': '# Global archive\n\nHidden.\n',
      'docs/other/guide.md': '# Other\n\nOutside the target.\n',
      'docs/team/drafts/draft.md': '# Draft\n\nExcluded by target.\n',
      'docs/team/guide.md': '# Team\n\nOutside the region.\n',
      'docs/team/standards/archive/old.md': '# Old\n\nExcluded by region.\n',
      'docs/team/standards/typescript.md': '# TypeScript\n\nIncluded.\n',
    })

    const result = await invoke('sync')

    expect(result.error).toBeUndefined()
    const output = await fixture.read('AGENTS.md')
    expect(output).toContain('docs/team/standards/typescript.md: Included.')
    expect(output).not.toContain('Global archive')
    expect(output).not.toContain('Other')
    expect(output).not.toContain('Draft')
    expect(output).not.toContain('Team')
    expect(output).not.toContain('Old')
  })

  it('rejects overlapping managed regions without changing the target', async () => {
    const fixture = await setup({
      'AGENTS.md': '<outer>\n<inner>\nold\n</inner>\n</outer>\n',
      'almanac.yaml': `targets:
  - path: AGENTS.md
    regions:
      - tags:
          start: <outer>
          end: </outer>
      - tags:
          start: <inner>
          end: </inner>
`,
      'docs/guide.md': '# Guide\n\nNew guidance.\n',
    })
    const before = await fixture.read('AGENTS.md')

    const result = await invoke('sync')

    expect(result.exitCode).toBe(2)
    expect(await fixture.read('AGENTS.md')).toBe(before)
  })

  it('does not write one region when another region is malformed', async () => {
    const fixture = await setup({
      'AGENTS.md': '<docs-index>\nold\n</docs-index>\n<standards-index>\nold\n',
      'almanac.yaml': `targets:
  - path: AGENTS.md
    regions:
      - tags:
          start: <docs-index>
          end: </docs-index>
      - tags:
          start: <standards-index>
          end: </standards-index>
`,
      'docs/guide.md': '# Guide\n\nNew guidance.\n',
    })
    const before = await fixture.read('AGENTS.md')

    const result = await invoke('sync')

    expect(result.exitCode).toBe(2)
    expect(await fixture.read('AGENTS.md')).toBe(before)
  })

  it('excludes tracked documents after they become ignored', async () => {
    const fixture = await setup({
      'AGENTS.md': '<docs-index>\n</docs-index>\n',
      'docs/private.md': '# Private\n\nDo not index this.\n',
    })
    await invoke('sync')
    await fixture.commit('initial index')
    await fixture.write('.gitignore', 'docs/private.md\n')

    const result = await invoke('sync')

    expect(result.error).toBeUndefined()
    expect(await fixture.read('AGENTS.md')).not.toContain('docs/private.md')
  })

  it('does not write valid targets when another target is malformed', async () => {
    const fixture = await setup({
      'AGENTS.md': '<docs-index>\nold\n</docs-index>\n',
      'BROKEN.md': '<docs-index>\n</docs-index>\n<docs-index>\n</docs-index>\n',
      'almanac.json': JSON.stringify({ targets: ['AGENTS.md', 'BROKEN.md'] }),
      'docs/guide.md': '# Guide\n\nNew guidance.\n',
    })
    const before = await fixture.read('AGENTS.md')

    const result = await invoke('sync')

    expect(result.exitCode).toBe(2)
    expect(await fixture.read('AGENTS.md')).toBe(before)
  })
})
