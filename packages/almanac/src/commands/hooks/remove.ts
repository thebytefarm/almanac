import { command } from 'maltty'

import { unwrapCommand } from '#lib/result.js'

/**
 * Removes Almanac's fragment while preserving unrelated hook bytes.
 */
export default command({
  description: 'Remove the Almanac pre-commit hook section',
  handler: async (ctx) => {
    const removed = unwrapCommand(ctx, await ctx.almanac.hooks.remove())
    ctx.log.raw(`Almanac hook is ${removed.status}`)
  },
})
