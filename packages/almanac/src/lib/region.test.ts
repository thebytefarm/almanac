import { describe, expect, it } from 'vitest'

import { createRegion } from './region.js'

const block = createRegion({
  filePath: 'AGENTS.md',
  tags: { end: '</docs-index>', start: '<docs-index>' },
})

describe('managed blocks', () => {
  it('replaces only full-line markers', () => {
    const source = `Mention <docs-index> in prose.
<docs-index>
old
</docs-index>
Tail.
`
    const result = block.replace(source, 'docs/a.md: A')
    expect(result.value).toBe(`Mention <docs-index> in prose.
<docs-index>

docs/a.md: A

</docs-index>
Tail.
`)
  })

  it('rejects duplicate markers', () => {
    const result = block.replace('<docs-index>\n</docs-index>\n<docs-index>\n</docs-index>\n', '')
    expect(result.ok).toBeFalsy()
    expect(result.error?.message).toContain('expected exactly one')
  })

  it('rejects rendered content containing managed markers', () => {
    const result = block.replace('<docs-index>\n</docs-index>\n', 'before\n</docs-index>\nafter')
    expect(result.ok).toBeFalsy()
    expect(result.error?.message).toContain('rendered body contains managed block tags')
  })

  it('initializes and removes a managed block without changing human content', () => {
    const source = '# Instructions\n'
    const initialized = block.initialize(source)
    expect(initialized.ok).toBeTruthy()
    if (!initialized.ok) {
      return
    }
    expect(block.remove(initialized.value).value).toBe(source)
  })
})
