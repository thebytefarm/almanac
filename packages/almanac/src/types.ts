import type { ConfigType } from 'maltty/config'

import type { almanacConfigSchema } from '#schema.js'

/**
 * Resolved, deeply readonly Almanac configuration after defaults and validation.
 */
export type AlmanacConfig = ConfigType<typeof almanacConfigSchema>

/**
 * Document data exposed to Liquid templates.
 */
export interface TemplateDocument {
  /**
   * Best available one-line description.
   */
  readonly description?: string
  /**
   * Basename including extension.
   */
  readonly fileName: string
  /**
   * Actual repository-relative path.
   */
  readonly filePath: string
  /**
   * Best available document title.
   */
  readonly title?: string
}
