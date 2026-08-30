import { hydrateReicons } from '../reicons.js'

const FEED_URL = 'https://raw.githubusercontent.com/cordisx/marketplace/main/marketplace.json'

const grid = document.querySelector('#plugin-grid')
const count = document.querySelector('#plugin-count')
const status = document.querySelector('#feed-status')
const search = document.querySelector('#plugin-search')

let plugins = []
let feedFallbackLocale = 'en'

function create(tag, className, text) {
  const element = document.createElement(tag)
  if (className !== undefined) element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

function iconSlot(name, size) {
  const slot = create('span', 'reicon-slot')
  slot.dataset.reicon = name
  slot.dataset.reiconSize = String(size)
  slot.setAttribute('aria-hidden', 'true')
  return slot
}

function canonicalSource(value) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Invalid plugin source')
  }
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '')
  return url.href
}

function validateString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`Plugin entry is missing ${label}`)
}

function validateFeed(value) {
  if (value === null || typeof value !== 'object' || value.schemaVersion !== 3 || !Array.isArray(value.plugins)) {
    throw new Error('Unsupported or malformed marketplace feed')
  }

  feedFallbackLocale = typeof value.fallbackLocale === 'string' ? value.fallbackLocale : 'en'
  const deduplicated = new Map()

  for (const plugin of value.plugins) {
    if (plugin === null || typeof plugin !== 'object' || plugin.schemaVersion !== 3) {
      throw new Error('Malformed plugin entry')
    }
    for (const key of ['id', 'name', 'description', 'version', 'source', 'license']) {
      validateString(plugin[key], key)
    }
    const source = canonicalSource(plugin.source)
    if (source !== plugin.source) throw new Error(`Plugin ${plugin.id} uses a non-canonical source`)
    const identity = `${source}\u0000${plugin.id}`
    if (!deduplicated.has(identity)) deduplicated.set(identity, plugin)
  }

  return [...deduplicated.values()]
}

function localeCandidates() {
  const candidates = []
  for (const locale of [...(navigator.languages ?? []), navigator.language, feedFallbackLocale]) {
    if (typeof locale !== 'string' || locale === '') continue
    if (!candidates.includes(locale)) candidates.push(locale)
    const language = locale.split('-')[0]
    if (language && !candidates.includes(language)) candidates.push(language)
  }
  return candidates
}

function localizedPlugin(plugin) {
  const localizations = plugin.localizations ?? {}
  let localized
  for (const locale of localeCandidates()) {
    if (localizations[locale]) {
      localized = localizations[locale]
      break
    }
  }

  return {
    ...plugin,
    name: localized?.name ?? plugin.name,
    description: localized?.description ?? plugin.description,
    keywords: localized?.keywords ?? plugin.keywords ?? [],
    authorNames: localized?.authors ?? (plugin.authors ?? []).map(author => author.name),
  }
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || 'CX'
}

function safeLink(value, fallback) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : fallback
  } catch {
    return fallback
  }
}

function searchableText(plugin) {
  return [
    plugin.id,
    plugin.name,
    plugin.description,
    plugin.source,
    ...(plugin.keywords ?? []),
    ...(plugin.authorNames ?? []),
  ].join('\n').toLocaleLowerCase()
}

function renderCard(plugin) {
  const card = create('article', 'catalog-card')
  const head = create('div', 'catalog-card-head')
  const icon = create('div', 'catalog-card-icon', initials(plugin.name))
  const title = create('div', 'catalog-card-title')
  title.append(create('h3', undefined, plugin.name), create('div', 'catalog-card-id', plugin.id))
  head.append(icon, title)
  card.append(head, create('p', 'catalog-card-description', plugin.description))

  const tags = create('div', 'catalog-tags')
  for (const keyword of (plugin.keywords ?? []).slice(0, 3)) tags.append(create('span', 'catalog-tag', keyword))
  tags.append(create('span', 'catalog-tag', `CordisX ${plugin.compatibility?.cordisx ?? 'unspecified'}`))
  card.append(tags)

  const meta = create('div', 'catalog-card-meta')
  const source = create('a', 'catalog-source')
  source.href = safeLink(plugin.homepage, safeLink(plugin.source, '#'))
  source.target = '_blank'
  source.rel = 'noreferrer'
  source.append(create('span', undefined, 'Source'), iconSlot('ArrowUpRight', 12))
  meta.append(create('span', undefined, `v${plugin.version} · ${plugin.license}`), source)
  card.append(meta)
  return card
}

function render() {
  const query = search.value.trim().toLocaleLowerCase()
  const filtered = plugins
    .map(localizedPlugin)
    .filter(plugin => searchableText(plugin).includes(query))

  count.textContent = `${filtered.length} of ${plugins.length} plugins`
  grid.replaceChildren()

  if (filtered.length === 0) {
    grid.append(create('div', 'catalog-empty', plugins.length === 0
      ? 'No plugins are published yet.'
      : 'No plugins match this search.'))
    return
  }

  for (const plugin of filtered) grid.append(renderCard(plugin))
  hydrateReicons(grid)
}

async function load() {
  status.textContent = `Loading ${new URL(FEED_URL).hostname}`
  status.dataset.error = 'false'

  try {
    const response = await fetch(FEED_URL, { headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`)
    plugins = validateFeed(await response.json())
    status.textContent = 'Validated marketplace feed v3 · public metadata'
    render()
  } catch (error) {
    status.dataset.error = 'true'
    status.textContent = error instanceof Error ? error.message : String(error)
    count.textContent = 'Feed unavailable'
    grid.replaceChildren(create('div', 'catalog-empty', 'The marketplace feed could not be loaded. Try again later or view the catalog on GitHub.'))
  }
}

search.addEventListener('input', render)
hydrateReicons()
void load()
