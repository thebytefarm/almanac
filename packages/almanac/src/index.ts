#!/usr/bin/env node

import { autoload, cli } from 'maltty'

import { middleware } from '#middleware/index.js'

import manifest from '../package.json' with { type: 'json' }

await cli({
  commands: autoload({ dir: `${import.meta.dirname}/commands` }),
  description: 'Keep repository documentation indexed in AGENTS.md',
  help: { header: 'almanac - keep the map true' },
  middleware,
  name: 'almanac',
  version: manifest.version,
})
