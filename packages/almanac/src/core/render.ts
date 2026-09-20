import { Liquid } from 'liquidjs'
import { attemptAsync, ok } from 'massaman/control'
import type { Result } from 'massaman/control'

import type { AlmanacConfig } from '#types.js'
import type { TemplateDocument } from '#types.js'

type Target = AlmanacConfig['targets'][number]

/**
 * Renders discovered documents into one configured target body.
 */
export interface IndexRenderer {
  readonly render: (
    target: Target,
    documents: readonly TemplateDocument[],
  ) => Promise<Result<string>>
}

/**
 * Creates a deterministic flat and Liquid index renderer.
 *
 * @returns A renderer with strict Liquid variables and filters.
 */
export function createIndexRenderer(): IndexRenderer {
  const liquid = new Liquid({ strictFilters: true, strictVariables: true })

  return {
    render: async (target, documents) => {
      const format = target.format
      if (format === 'flat') {
        return ok(
          documents
            .map(
              (document) =>
                `${document.filePath}: ${document.description ?? document.title ?? document.fileName}`,
            )
            .join('\n'),
        )
      }

      const rendered = await attemptAsync(() =>
        liquid.parseAndRender(format.template, { documents }),
      )
      if (!rendered.ok) {
        return rendered
      }
      return ok(rendered.value.trim())
    },
  }
}
