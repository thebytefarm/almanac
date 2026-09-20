import type { CommandContext } from 'maltty'
import { ok } from 'massaman/control'
import type { Result } from 'massaman/control'
import { match } from 'massaman/match'

/**
 * Converts an immutable list of results into one result containing all values.
 *
 * @param results - Results produced by independent functional operations.
 * @returns The first error or the complete immutable value list.
 */
export function collectResults<T>(results: readonly Result<T>[]): Result<readonly T[]> {
  const failure = results.find((result) => !result.ok)
  if (failure && !failure.ok) {
    return failure
  }
  return ok(results.filter((result) => result.ok).map((result) => result.value))
}

/**
 * Resolves a Massaman result at the CLI boundary or terminates the command.
 *
 * @param ctx - Active maltty command context.
 * @param result - Operational result returned by an Almanac service.
 * @returns The successful result value.
 */
export function unwrapCommand<T>(ctx: CommandContext, result: Result<T>): T {
  return match(result)
    .with({ ok: true }, ({ value }) => value)
    .with({ ok: false }, ({ error }) => failCommand(ctx, error))
    .exhaustive()
}

/**
 * Ends a maltty command with an operational error exit code.
 *
 * @param ctx - Active maltty command context.
 * @param error - Massaman result error to present to the user.
 */
function failCommand(ctx: CommandContext, error: Error): never {
  ctx.fail(error.message, { exitCode: 2 })
}
