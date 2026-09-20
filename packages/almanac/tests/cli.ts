import { join } from 'node:path'

import { autoload } from 'maltty'
import { runCommand } from 'maltty/test'
import { afterEach } from 'vitest'

import { middleware } from '#middleware/index.js'

import manifest from '../package.json' with { type: 'json' }
import { createGitFixture } from './fixture.js'
import type { GitFixture } from './fixture.js'

const fixtures: GitFixture[] = []
const originalCwd = process.cwd()
const commands = autoload({ dir: join(import.meta.dirname, '../dist/commands') })
type ProcessListener = Parameters<typeof process.removeListener>[1]

afterEach(async () => {
  process.chdir(originalCwd)
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()))
})

export async function setup(files: Readonly<Record<string, string>> = {}): Promise<GitFixture> {
  const fixture = await createGitFixture({ 'package.json': '{"private":true}\n', ...files })
  fixtures.push(fixture)
  process.chdir(fixture.path)
  return fixture
}

export async function invoke(...args: readonly string[]) {
  const listenerSnapshots = ['uncaughtException', 'unhandledRejection'].map((event) => ({
    event,
    listeners: process.rawListeners(event) as readonly ProcessListener[],
  }))
  const result = await runCommand({
    args,
    commands,
    middleware,
    name: 'almanac',
    version: manifest.version,
  })
  removeAddedListeners(listenerSnapshots)
  return result
}

function removeAddedListeners(
  snapshots: readonly { readonly event: string; readonly listeners: readonly ProcessListener[] }[],
): void {
  const [snapshot, ...remaining] = snapshots
  if (!snapshot) {
    return
  }
  const added = (process.rawListeners(snapshot.event) as readonly ProcessListener[]).filter(
    (listener) => !snapshot.listeners.includes(listener),
  )
  removeListeners(snapshot.event, added)
  removeAddedListeners(remaining)
}

function removeListeners(event: string, listeners: readonly ProcessListener[]): void {
  const [listener, ...remaining] = listeners
  if (!listener) {
    return
  }
  process.removeListener(event, listener)
  removeListeners(event, remaining)
}
