import { describe, expect, it } from 'vitest'

import { invoke, setup } from '../cli.js'

describe('diff command', () => {
  it('requires a base revision', async () => {
    await setup()

    const result = await invoke('diff')

    expect(result.exitCode).toBe(1)
  })

  it('classifies generated-only and human-authored changes', async () => {
    const fixture = await setup({
      'AGENTS.md': '# Rules\n\n<docs-index>\n</docs-index>\n',
      'docs/a.md': '# A\n\nFirst.\n',
    })
    await invoke('sync')
    await fixture.commit('initial index')
    const base = await fixture.git('rev-parse', 'HEAD')
    await fixture.write('docs/a.md', '# A\n\nSecond.\n')
    await invoke('sync')
    await fixture.commit('generated change')

    const generated = await invoke('diff', '--base', base, '--format', 'json')
    expect(generated.exitCode).toBeUndefined()

    await fixture.write('AGENTS.md', `${await fixture.read('AGENTS.md')}\nHuman rule.\n`)
    await fixture.commit('human change')
    const human = await invoke('diff', '--base', base, '--format', 'json')
    expect(human.exitCode).toBe(1)
  })

  it('classifies moving the managed block as human-authored', async () => {
    const fixture = await setup({
      'AGENTS.md': '# Before\n\n<docs-index>\nentry\n</docs-index>\n\n# After\n',
    })
    await fixture.commit('initial placement')
    const base = await fixture.git('rev-parse', 'HEAD')
    await fixture.write('AGENTS.md', '# Before\n\n# After\n\n<docs-index>\nentry\n</docs-index>\n')
    await fixture.commit('move managed block')

    const result = await invoke('diff', '--base', base, '--format', 'json')

    expect(result.exitCode).toBe(1)
  })
})
