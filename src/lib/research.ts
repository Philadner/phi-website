type ResearchMeta = {
  author: string
  date: string
  tags: string[]
}

export type ResearchPost = ResearchMeta & {
  slug: string
  title: string
  subtitle: string
  content: string
}

const postFiles = import.meta.glob('../../research posts/**/post.md', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

const metaFiles = import.meta.glob('../../research posts/**/meta.toml', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

function stripQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function parseTomlArray(value: string) {
  const inner = value.trim().replace(/^\[/, '').replace(/\]$/, '')
  if (!inner.trim()) return []

  return inner
    .split(',')
    .map((item) => stripQuotes(item.trim()))
    .filter(Boolean)
}

function parseMetaToml(source: string): ResearchMeta {
  const meta: ResearchMeta = {
    author: '',
    date: '',
    tags: [],
  }

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()

    if (key === 'author') meta.author = stripQuotes(value)
    if (key === 'date') meta.date = stripQuotes(value)
    if (key === 'tags') meta.tags = parseTomlArray(value)
  }

  return meta
}

function extractHeading(markdown: string, level: 1 | 2) {
  const pattern = new RegExp(`^${'#'.repeat(level)}\\s+(.+)$`, 'm')
  const match = markdown.match(pattern)
  return match?.[1]?.trim() ?? ''
}

function stripLeadHeadings(markdown: string) {
  const lines = markdown.split(/\r?\n/)
  let index = 0

  while (index < lines.length && !lines[index].trim()) {
    index += 1
  }

  if (lines[index]?.startsWith('# ')) {
    index += 1
  }

  while (index < lines.length && !lines[index].trim()) {
    index += 1
  }

  if (lines[index]?.startsWith('## ')) {
    index += 1
  }

  while (index < lines.length && !lines[index].trim()) {
    index += 1
  }

  return lines.slice(index).join('\n')
}

function getSlugFromPath(path: string) {
  const match = path.match(/research posts\/([^/]+)\/post\.md$/)
  return match?.[1] ?? ''
}

function formatFallbackTitle(slug: string) {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function compareByDateDesc(a: ResearchPost, b: ResearchPost) {
  const aTime = Date.parse(a.date)
  const bTime = Date.parse(b.date)

  if (Number.isNaN(aTime) && Number.isNaN(bTime)) return a.title.localeCompare(b.title)
  if (Number.isNaN(aTime)) return 1
  if (Number.isNaN(bTime)) return -1

  return bTime - aTime
}

export function getResearchPosts() {
  return Object.entries(postFiles)
    .map(([path, markdown]) => {
      const slug = getSlugFromPath(path)
      const metaPath = path.replace(/post\.md$/, 'meta.toml')
      const meta = parseMetaToml(metaFiles[metaPath] ?? '')
      const title = extractHeading(markdown, 1) || formatFallbackTitle(slug)
      const subtitle = extractHeading(markdown, 2)

      return {
        slug,
        title,
        subtitle,
        content: stripLeadHeadings(markdown),
        ...meta,
      } satisfies ResearchPost
    })
    .filter((post) => post.slug)
    .sort(compareByDateDesc)
}

export function getResearchPost(slug: string) {
  return getResearchPosts().find((post) => post.slug === slug) ?? null
}
