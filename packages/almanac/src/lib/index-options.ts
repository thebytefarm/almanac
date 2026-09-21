import { z } from 'zod'

/**
 * Repeatable CLI overrides shared by index-producing commands.
 */
export const indexOptions = z.object({
  exclude: z
    .array(z.string())
    .describe('Override excluded document globs; repeat for multiple patterns')
    .optional(),
  include: z
    .array(z.string())
    .describe('Override included document globs; repeat for multiple patterns')
    .optional(),
  target: z
    .array(z.string())
    .describe('Override index target paths; repeat for multiple targets')
    .optional(),
})
