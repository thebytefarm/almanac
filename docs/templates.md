---
title: Liquid Templates
description: Build a custom index using the stable document object.
---

# Liquid Templates

Use a Liquid template when the flat `path: description` format does not fit an instruction file.

```yaml
targets:
  - path: AGENTS.md
    format:
      template: |-
        [Documentation]
        {% for document in documents %}
        - {{ document.filePath }}{% if document.description %}: {{ document.description }}{% endif %}
        {% endfor %}
```

The rendered template is placed inside the target's configured region tags. Almanac trims whitespace at the outer edge but preserves the template's internal layout.

## Document object

Liquid receives one `documents` array sorted by `filePath`.

```ts
interface TemplateDocument {
  readonly filePath: string
  readonly fileName: string
  readonly title?: string
  readonly description?: string
}
```

| Field         | Always present | Description                                      |
| ------------- | -------------- | ------------------------------------------------ |
| `filePath`    | yes            | Actual repository-relative POSIX path            |
| `fileName`    | yes            | Basename including extension                     |
| `title`       | no             | Frontmatter title or first Markdown heading      |
| `description` | no             | Frontmatter description or derived prose summary |

Strict variables and filters are enabled. A missing property access or unknown filter fails the command rather than emitting a partial index.

## Multiple regions and targets

Each target receives the same discovered document catalog. Regions can narrow that catalog with their own `include` and `exclude` filters and render independently. Use multiple regions when one instruction file needs separate generated sections; use multiple targets for separate files.
