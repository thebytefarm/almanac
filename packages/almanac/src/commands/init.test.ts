import { decorateContext } from 'maltty'
import { createTestContext, mockPrompts } from 'maltty/test'
import { ok } from 'massaman/control'
import { describe, expect, it, vi } from 'vitest'

import type { Almanac } from '#client.js'

import init from './init.js'

describe('init command workflow', () => {
  it('prompts for optional hook installation', async () => {
    const prompts = mockPrompts({ confirm: [true] })
    const { ctx } = createTestContext({ args: {}, prompts })
    const initialize = vi.fn(async () => ok(undefined))
    decorateContext(ctx, 'almanac', createAlmanac(initialize))

    await init.handler?.(ctx)

    expect(prompts.confirm).toHaveBeenCalledWith({
      initialValue: false,
      message: 'Install the Almanac pre-commit hook?',
    })
    expect(initialize).toHaveBeenCalledWith({
      exclude: undefined,
      hooks: true,
      include: undefined,
      targets: undefined,
    })
  })

  it('uses an explicit flag without prompting', async () => {
    const prompts = mockPrompts()
    const { ctx } = createTestContext({ args: { hooks: false }, prompts })
    const initialize = vi.fn(async () => ok(undefined))
    decorateContext(ctx, 'almanac', createAlmanac(initialize))

    await init.handler?.(ctx)

    expect(prompts.confirm).not.toHaveBeenCalled()
    expect(initialize).toHaveBeenCalledWith({
      exclude: undefined,
      hooks: false,
      include: undefined,
      targets: undefined,
    })
  })
})

function createAlmanac(initialize: Almanac['initialize']): Almanac {
  const hookStatus = { path: '.git/hooks/pre-commit', status: 'not-installed' as const }
  return {
    check: async () => ok([]),
    diff: async () => ok({ classification: 'none', targets: [] }),
    hooks: {
      install: async () => ok(hookStatus),
      remove: async () => ok(hookStatus),
      status: async () => ok(hookStatus),
    },
    index: async () => ok([]),
    initialize,
    link: async () => ok([]),
    sync: async () => ok([]),
  }
}
