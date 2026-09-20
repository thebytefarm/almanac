import { execFile } from 'node:child_process'
import { chmod, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

import { invoke, setup } from '../cli.js'

const exec = promisify(execFile)

describe('hooks commands', () => {
  it('installs an executable hook and reports its status', async () => {
    const fixture = await setup({ 'pnpm-lock.yaml': 'lockfileVersion: 9\n' })

    const installed = await invoke('hooks', 'install')
    const status = await invoke('hooks', 'status', '--format', 'json')

    expect(installed.error).toBeUndefined()
    expect(status.error).toBeUndefined()
    expect(await fixture.read('.git/hooks/pre-commit')).toContain(
      'pnpm exec almanac sync || exit $?',
    )
    const hookStat = await stat(join(fixture.path, '.git/hooks/pre-commit'))
    expect(hookStat.mode & 0o100).toBe(0o100)
  })

  it('uses a project script when the binary is not linked at the repository root', async () => {
    const fixture = await setup({
      'package.json': JSON.stringify({ private: true, scripts: { almanac: 'node ./cli.mjs' } }),
      'pnpm-lock.yaml': 'lockfileVersion: 9\n',
    })

    const result = await invoke('hooks', 'install')

    expect(result.error).toBeUndefined()
    expect(await fixture.read('.git/hooks/pre-commit')).toContain('pnpm almanac sync || exit $?')
  })

  it('rejects non-shell hooks without changing them', async () => {
    const fixture = await setup()
    const source = '#!/usr/bin/env node\nconsole.log("keep")\n'
    await fixture.write('.git/hooks/pre-commit', source)

    const result = await invoke('hooks', 'install')

    expect(result.exitCode).toBe(2)
    expect(await fixture.read('.git/hooks/pre-commit')).toBe(source)
  })

  it('repairs stale managed hook content', async () => {
    const fixture = await setup({ 'pnpm-lock.yaml': 'lockfileVersion: 9\n' })
    await fixture.write(
      '.git/hooks/pre-commit',
      '#!/bin/sh\n# almanac:start\ntrue\n# almanac:end\necho keep\n',
    )

    const result = await invoke('hooks', 'install')

    expect(result.error).toBeUndefined()
    expect(await fixture.read('.git/hooks/pre-commit')).toBe(
      '#!/bin/sh\n# almanac:start\npnpm exec almanac sync || exit $?\n# almanac:end\necho keep\n',
    )
  })

  it('reports a managed hook that is not executable', async () => {
    const fixture = await setup()
    await fixture.write(
      '.git/hooks/pre-commit',
      '#!/bin/sh\n# almanac:start\nnpm exec --offline -- almanac sync || exit $?\n# almanac:end\n',
    )
    await chmod(join(fixture.path, '.git/hooks/pre-commit'), 0o644)

    const result = await invoke('hooks', 'status')

    expect(result.exitCode).toBe(2)
  })

  it('stops an existing hook when Almanac fails', async () => {
    const fixture = await setup({
      'package.json': JSON.stringify({ private: true, scripts: { almanac: 'exit 7' } }),
      'pnpm-lock.yaml': 'lockfileVersion: 9\n',
    })
    await fixture.write('.git/hooks/pre-commit', '#!/bin/sh\ntrue\n')
    await invoke('hooks', 'install')

    const execution = exec(join(fixture.path, '.git/hooks/pre-commit'), { cwd: fixture.path })

    await expect(execution).rejects.toBeDefined()
  })

  it('prefers an explicit package manager over stale lockfiles', async () => {
    const fixture = await setup({
      'package.json': JSON.stringify({ packageManager: 'yarn@4.10.0', private: true }),
      'pnpm-lock.yaml': 'lockfileVersion: 9\n',
    })

    const result = await invoke('hooks', 'install')

    expect(result.error).toBeUndefined()
    expect(await fixture.read('.git/hooks/pre-commit')).toContain(
      'yarn exec almanac sync || exit $?',
    )
  })

  it('supports a repository-local custom hooks directory', async () => {
    const fixture = await setup()
    await fixture.git('config', 'core.hooksPath', '.githooks')

    const result = await invoke('hooks', 'install')

    expect(result.error).toBeUndefined()
    expect(await fixture.read('.githooks/pre-commit')).toContain('# almanac:start')
  })

  it('rejects a shared hooks directory outside the repository', async () => {
    const fixture = await setup()
    await fixture.git('config', 'core.hooksPath', '../shared-hooks')

    const result = await invoke('hooks', 'install')

    expect(result.exitCode).toBe(2)
  })

  it('rejects CRLF hooks without changing them', async () => {
    const fixture = await setup()
    const source = '#!/bin/sh\r\necho keep\r\n'
    await fixture.write('.git/hooks/pre-commit', source)

    const result = await invoke('hooks', 'install')

    expect(result.exitCode).toBe(2)
    expect(await fixture.read('.git/hooks/pre-commit')).toBe(source)
  })

  it('rejects malformed hook markers', async () => {
    const fixture = await setup()
    await fixture.write('.git/hooks/pre-commit', '#!/bin/sh\n# almanac:start\n')

    const result = await invoke('hooks', 'status')

    expect(result.exitCode).toBe(2)
  })

  it('removes only the managed hook fragment', async () => {
    const fixture = await setup()
    await fixture.write(
      '.git/hooks/pre-commit',
      '#!/bin/sh\n# almanac:start\nnpm exec -- almanac sync\n# almanac:end\necho keep\n',
    )

    const result = await invoke('hooks', 'remove')

    expect(result.error).toBeUndefined()
    expect(await fixture.read('.git/hooks/pre-commit')).toBe('#!/bin/sh\necho keep\n')
  })

  it('preserves CRLF bytes around a removed hook fragment', async () => {
    const fixture = await setup()
    await fixture.write(
      '.git/hooks/pre-commit',
      '#!/bin/sh\r\n# almanac:start\r\nnpm exec -- almanac sync\r\n# almanac:end\r\necho keep\r\n',
    )

    const result = await invoke('hooks', 'remove')

    expect(result.error).toBeUndefined()
    expect(await fixture.read('.git/hooks/pre-commit')).toBe('#!/bin/sh\r\necho keep\r\n')
  })
})
