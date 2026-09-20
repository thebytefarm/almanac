import { command } from 'maltty'

import install from './install.js'
import remove from './remove.js'
import status from './status.js'

/**
 * Groups lifecycle commands for Almanac's isolated pre-commit hook fragment.
 */
export default command({
  commands: { install, remove, status },
  description: 'Manage Almanac in the repository pre-commit hook',
})
