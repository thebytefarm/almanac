/**
 * Repeatable CLI overrides shared by index-producing commands.
 */
export const indexOptions = {
  exclude: {
    description: 'Override excluded document globs; repeat for multiple patterns',
    type: 'array',
  },
  include: {
    description: 'Override included document globs; repeat for multiple patterns',
    type: 'array',
  },
  target: {
    description: 'Override index target paths; repeat for multiple targets',
    type: 'array',
  },
} as const

/**
 * Narrows Maltty's array option value for the application facade.
 *
 * @param value - Parsed command option value.
 * @returns String values when the option was provided.
 */
export function readStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  if (!value.every((item): item is string => typeof item === 'string')) {
    return undefined
  }
  return value
}
