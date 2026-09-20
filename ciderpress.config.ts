import { defineConfig } from 'ciderpress'

/**
 * Ciderpress site configuration for Almanac's public documentation.
 */
export default defineConfig({
  title: 'Almanac',
  description: 'Keep the map true.',
  theme: { themes: ['grannysmith'], defaultVariant: 'dark' },
  brand: {
    logo: '/logo.svg',
    favicon: '/logo.svg',
  },
  topbar: {
    nav: [
      { title: 'Start', link: '/getting-started' },
      { title: 'Concepts', link: '/how-it-works' },
      { title: 'Reference', link: '/configuration' },
    ],
    cta: { text: 'Install Almanac', href: '/getting-started' },
  },
  sidebar: {
    top: [{ text: 'Home', href: '/', icon: 'pixelarticons:home' }],
    promo: {
      title: 'A map, not a manual',
      body: 'Almanac points agents at the right document without loading every document.',
      cta: { text: 'See how it works', href: '/how-it-works' },
    },
  },
  home: {
    hero: {
      label: 'Deterministic · Offline · Git-native',
      tagline:
        'Generate a compact index of your repository docs inside `AGENTS.md`, then keep it true on every commit.',
      actions: [
        { variant: 'primary', text: 'Get started', href: '/getting-started' },
        { variant: 'secondary', text: 'Read the design', href: '/how-it-works' },
      ],
    },
    blocks: [
      {
        type: 'features',
        items: [
          {
            title: 'Visible by default',
            description: 'Agents see the document map in the instruction file they already load.',
            icon: 'pixelarticons:map',
          },
          {
            title: 'Cheap by design',
            description:
              'One terse line per document. No document bodies, embeddings, or generated overview.',
            icon: 'pixelarticons:coin',
          },
          {
            title: 'Current by construction',
            description:
              'The optional pre-commit hook regenerates and stages only the managed targets it changes.',
            icon: 'pixelarticons:reload',
          },
        ],
      },
      {
        type: 'split',
        label: 'The whole loop',
        title: 'Find. Describe. Write. Stage.',
        body: 'Almanac discovers configured Markdown, derives metadata from the files themselves, renders a flat or Liquid index, and replaces one line-anchored managed block.',
        bullets: [
          'Respects include and exclude globs plus .gitignore',
          'Preserves every byte of human-owned instruction content',
          'Uses the same analysis pipeline for sync and CI drift checks',
        ],
        cta: { variant: 'secondary', text: 'Configuration reference', href: '/configuration' },
        visual: {
          type: 'terminal',
          windowTitle: 'terminal',
          command: 'pnpm exec almanac sync',
          lines: [{ kind: 'ok', text: 'Updated 1 target(s)' }],
        },
      },
      {
        type: 'cta',
        title: 'Put the map where agents look.',
        body: 'Initialize Almanac once. Git keeps the index from drifting after that.',
        actions: [{ variant: 'primary', text: 'Install and initialize', href: '/getting-started' }],
      },
    ],
  },
  pages: [
    {
      title: 'Getting Started',
      description: 'Install Almanac, initialize the managed index, and verify the repository.',
      path: '/getting-started',
      include: 'docs/getting-started.md',
      icon: 'pixelarticons:speed-fast',
    },
    {
      title: 'How It Works',
      description: 'The indexing pipeline, managed-block rules, and intentional limits.',
      path: '/how-it-works',
      include: 'docs/how-it-works.md',
      icon: 'pixelarticons:map',
    },
    {
      title: 'Configuration',
      description: 'The complete YAML and JSON configuration contract.',
      path: '/configuration',
      include: 'docs/configuration.md',
      icon: 'pixelarticons:sliders',
    },
    {
      title: 'CLI Reference',
      description: 'Commands, options, output, and exit behavior.',
      path: '/cli',
      include: 'docs/cli.md',
      icon: 'pixelarticons:terminal',
    },
    {
      title: 'Liquid Templates',
      description: 'Build a custom index using the stable document object.',
      path: '/templates',
      include: 'docs/templates.md',
      icon: 'pixelarticons:script-text',
    },
  ],
  socials: [{ icon: 'github', url: 'https://github.com/thebytefarm/almanac' }],
  footer: {
    message: 'A field guide for coding agents.',
    copyright: { company: 'thebytefarm' },
    socials: true,
  },
})
