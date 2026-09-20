import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { invoke, setup } from '../cli.js'

describe('sync command', () => {
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
    expect(await fixture.git('diff', '--cached', '--name-only')).toBe('AGENTS.md')
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
