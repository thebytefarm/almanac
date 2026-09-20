import { command } from 'maltty'

import { unwrapCommand } from '#lib/result.js'

/**
 * Installs or repairs Almanac's pre-commit hook fragment.
 */
export default command({
  description: 'Install the Almanac pre-commit hook section',
  handler: async (ctx) => {
    const installed = unwrapCommand(ctx, await ctx.almanac.hooks.install())
    ctx.log.raw(`Installed Almanac hook in ${installed.path}`)
  },
})
