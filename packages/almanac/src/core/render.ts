import { Liquid } from 'liquidjs'
import { attemptAsync, ok } from 'massaman/control'
import type { Result } from 'massaman/control'

import type { AlmanacConfig } from '#types.js'
import type { TemplateDocument } from '#types.js'

type ManagedRegion = AlmanacConfig['targets'][number]['regions'][number]

/**
 * Renders discovered documents into one configured target body.
 */
export interface IndexRenderer {
  readonly render: (
    region: ManagedRegion,
    documents: readonly TemplateDocument[],
  ) => Promise<Result<string>>
}

/**
 * Creates deterministic built-in and Liquid index renderers.
 *
 * @returns A renderer with strict Liquid variables and filters.
 */
export function createIndexRenderer(): IndexRenderer {
  const liquid = new Liquid({ strictFilters: true, strictVariables: true })

  return {
    render: async (region, documents) => {
      const template = region.template
      if (!template) {
        return ok(
          documents
            .map(
              (document) =>
                `${document.filePath}: ${document.description ?? document.title ?? document.fileName}`,
            )
            .join('\n'),
        )
      }

      const rendered = await attemptAsync(() => liquid.parseAndRender(template, { documents }))
      if (!rendered.ok) {
        return rendered
      }
      return ok(rendered.value.trim())
    },
  }
}
