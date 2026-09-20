import { command } from 'maltty'

import { unwrapCommand } from '#lib/result.js'

/**
 * Classifies target changes between two Git revisions by content ownership.
 */
export default command({
  description: 'Classify human-owned AGENTS.md changes between Git revisions',
  options: {
    base: {
      description: 'Base Git revision',
      required: true,
      type: 'string',
    },
    format: {
      choices: ['text', 'json'] as const,
      default: 'text',
      description: 'Output format',
      type: 'string',
    },
    head: {
      default: 'HEAD',
      description: 'Head Git revision',
      type: 'string',
    },
  },
  handler: async (ctx) => {
    const diff = unwrapCommand(
      ctx,
      await ctx.almanac.diff(String(ctx.args.base), String(ctx.args.head)),
    )
    if (ctx.args.format === 'json') {
      ctx.log.raw(JSON.stringify(diff))
    } else {
      ctx.log.raw(
        [
          `Classification: ${diff.classification}`,
          ...diff.targets.map((target) => `${target.path}: ${target.classification}`),
        ].join('\n'),
      )
    }
    if (diff.classification === 'human-authored') {
      ctx.fail('Human-authored target content changed', {
        code: 'ALMANAC_HUMAN_CHANGE',
        exitCode: 1,
      })
    }
  },
})
