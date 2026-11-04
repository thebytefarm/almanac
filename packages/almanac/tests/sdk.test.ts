import { execFile } from 'node:child_process'
import { lstat, mkdtemp, readlink, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { afterEach, describe, expect, it } from 'vitest'

import { createAlmanac } from '#sdk.js'

import { createGitFixture } from './fixture.js'
import type { GitFixture } from './fixture.js'

const exec = promisify(execFile)
const fixtures: GitFixture[] = []
const instructions =
  '# Human instructions\n\n<docs-index>\nstale\n</docs-index>\n\nKeep this footer.\n'
const files = {
  'AGENTS.md': instructions,
  'manual/guide.md': '# Guide\n\nHost-owned documentation.\n',
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()))
})

async function setup(seed: Readonly<Record<string, string>> = files): Promise<GitFixture> {
  const fixture = await createGitFixture(seed)
  fixtures.push(fixture)
  return fixture
}

describe('published SDK', () => {
  it('runs the published entry point silently without starting the CLI', async () => {
    const fixture = await setup()
    const result = await exec(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `const { createAlmanac } = await import('almanac-md/sdk')
         await createAlmanac({
           cwd: process.argv[1],
           config: { include: 'manual/**/*.md', links: [] },
         }).sync()`,
        fixture.path,
      ],
      { cwd: join(import.meta.dirname, '..') },
    )

    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('')
    expect(await fixture.read('AGENTS.md')).toContain('manual/guide.md: Host-owned documentation.')
  })

  it('uses explicit config instead of repository config and preserves human content', async () => {
    const fixture = await setup({ ...files, 'almanac.yaml': 'invalid: [yaml\n' })
    await fixture.commit('initial files')
    const originalCwd = process.cwd()
    const almanac = createAlmanac({
      config: { include: 'manual/**/*.md', links: [] },
      cwd: fixture.path,
    })

    expect(await almanac.check()).toEqual([{ changed: true, path: 'AGENTS.md' }])
    expect(await fixture.read('AGENTS.md')).toBe(instructions)
    expect(await almanac.sync()).toEqual([{ changed: true, path: 'AGENTS.md' }])
    expect(await fixture.read('AGENTS.md')).toBe(
      '# Human instructions\n\n<docs-index>\n\nmanual/guide.md: Host-owned documentation.\n\n</docs-index>\n\nKeep this footer.\n',
    )
    expect(await almanac.check()).toEqual([{ changed: false, path: 'AGENTS.md' }])
    expect(await fixture.git('diff', '--cached', '--name-only')).toBe('')
    expect(process.cwd()).toBe(originalCwd)
  })

  it('renders configured targets, regions, filters, and templates', async () => {
    const fixture = await setup({
      ...files,
      'TOOL.md': '# Tool\n\n<host-docs>\nold\n</host-docs>\n',
      'manual/private.md': '# Private\n\nNot for indexing.\n',
    })
    const almanac = createAlmanac({
      config: {
        exclude: 'manual/private.md',
        include: 'manual/**/*.md',
        links: [],
        targets: {
          path: 'TOOL.md',
          tags: { start: '<host-docs>', end: '</host-docs>' },
          template: '{% for doc in documents %}{{ doc.title }}: {{ doc.filePath }}{% endfor %}',
        },
      },
      cwd: fixture.path,
    })

    await almanac.index()

    expect(await fixture.read('TOOL.md')).toContain('Guide: manual/guide.md')
    expect(await fixture.read('TOOL.md')).not.toContain('private.md')
    expect(await fixture.read('AGENTS.md')).toBe(instructions)
    expect(await fixture.git('diff', '--cached', '--name-only')).toBe('')
  })

  it('stages only when requested and preserves unrelated unstaged instructions', async () => {
    const fixture = await setup()
    await fixture.commit('initial files')
    await fixture.write('AGENTS.md', instructions.replace('Human instructions', 'Unstaged edits'))
    const almanac = createAlmanac({
      config: { include: 'manual/**/*.md', links: [] },
      cwd: fixture.path,
    })

    await almanac.index({ stage: true })

    const staged = await fixture.git('show', ':AGENTS.md')
    expect(staged).toContain('# Human instructions')
    expect(staged).toContain('manual/guide.md')
    expect(staged).not.toContain('Unstaged edits')
    expect(await fixture.read('AGENTS.md')).toContain('# Unstaged edits')
    const revision = await fixture.git('rev-parse', 'HEAD')
    expect(await almanac.diff(revision, revision)).toEqual({
      classification: 'none',
      targets: [{ classification: 'none', path: 'AGENTS.md' }],
    })
  })

  it('initializes markers and links without staging or installing hooks by default', async () => {
    const fixture = await setup({ 'docs/guide.md': '# Guide\n\nDocumentation.\n' })
    const almanac = createAlmanac({ config: {}, cwd: fixture.path })

    expect(await almanac.initialize()).toBeUndefined()

    expect(await fixture.read('AGENTS.md')).toContain('docs/guide.md: Documentation.')
    expect(await readlink(join(fixture.path, 'CLAUDE.md'))).toBe('AGENTS.md')
    expect(await fixture.git('diff', '--cached', '--name-only')).toBe('')
    expect((await almanac.hooks.status()).status).toBe('not-installed')
  })

  it.each(['index', 'sync'] as const)(
    'stages existing generated output after an unstaged %s call',
    async (operation) => {
      const fixture = await setup()
      await fixture.commit('initial files')
      await fixture.write('AGENTS.md', instructions.replace('Human instructions', 'Unstaged edits'))
      const almanac = createAlmanac({
        config: { include: 'manual/**/*.md', links: ['claude'] },
        cwd: fixture.path,
      })

      await almanac[operation]()
      expect(await fixture.git('diff', '--cached', '--name-only')).toBe('')
      const before = await fixture.read('AGENTS.md')
      await almanac[operation]({ stage: true })

      const staged = await fixture.git('show', ':AGENTS.md')
      expect(staged).toContain('manual/guide.md: Host-owned documentation.')
      expect(staged).toContain('# Human instructions')
      expect(staged).not.toContain('Unstaged edits')
      expect(await fixture.read('AGENTS.md')).toBe(before)
      if (operation === 'sync') {
        expect(await fixture.git('show', ':CLAUDE.md')).toBe('AGENTS.md')
      }
    },
  )

  it('creates links without staging unless requested', async () => {
    const fixture = await setup()
    await fixture.commit('initial files')
    const almanac = createAlmanac({ config: { links: ['claude'] }, cwd: fixture.path })

    expect(await almanac.link()).toEqual([{ changed: true, path: 'CLAUDE.md' }])
    expect(await fixture.git('diff', '--cached', '--name-only')).toBe('')
    expect((await lstat(join(fixture.path, 'CLAUDE.md'))).isSymbolicLink()).toBe(true)
  })

  it('stages a compatibility link created by an earlier unstaged call', async () => {
    const fixture = await setup()
    await fixture.commit('initial files')
    const almanac = createAlmanac({ config: { links: ['claude'] }, cwd: fixture.path })

    await almanac.link()
    expect(await fixture.git('diff', '--cached', '--name-only')).toBe('')
    await almanac.link({ stage: true })

    expect(await fixture.git('diff', '--cached', '--name-only')).toBe('CLAUDE.md')
    expect(await fixture.git('show', ':CLAUDE.md')).toBe('AGENTS.md')
  })

  it('rejects conflicting links as Errors before updating targets', async () => {
    const fixture = await setup({ ...files, 'CLAUDE.md': '# Preserve me\n' })
    const almanac = createAlmanac({
      config: { include: 'manual/**/*.md' },
      cwd: fixture.path,
    })

    await expect(almanac.sync()).rejects.toThrow('an existing path would be overwritten')
    expect(await fixture.read('AGENTS.md')).toBe(instructions)
    expect(await fixture.read('CLAUDE.md')).toBe('# Preserve me\n')
  })

  it('rejects symlink targets without changing their destinations', async () => {
    const fixture = await setup({ ...files, 'original.md': instructions })
    await symlink('original.md', join(fixture.path, 'linked.md'))
    const almanac = createAlmanac({
      config: { targets: 'linked.md', links: [] },
      cwd: fixture.path,
    })

    await expect(almanac.index()).rejects.toThrow('target must not be a symbolic link')
    expect(await fixture.read('original.md')).toBe(instructions)
  })

  it('throws for invalid configuration before writing anything', async () => {
    const fixture = await setup()

    expect(() =>
      createAlmanac({ config: { targets: '../outside.md' }, cwd: fixture.path }),
    ).toThrow()
    expect(await fixture.read('AGENTS.md')).toBe(instructions)
  })

  it('throws an Error when no Git repository exists', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'almanac-sdk-'))
    try {
      expect(() => createAlmanac({ config: {}, cwd: directory })).toThrow('No Git repository')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
