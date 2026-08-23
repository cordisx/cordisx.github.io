const FEED_URL = 'https://raw.githubusercontent.com/cordisx/marketplace/main/marketplace.json'

const grid = document.querySelector('#plugin-grid')
const count = document.querySelector('#plugin-count')
const status = document.querySelector('#feed-status')
const search = document.querySelector('#plugin-search')
let plugins = []

function create(tag, className, text) {
  const element = document.createElement(tag)
  if (className !== undefined) element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

function canonicalSource(value) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('invalid plugin source')
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '')
  return url.href
}

function validateFeed(value) {
  if (value === null || typeof value !== 'object' || value.schemaVersion !== 1 || !Array.isArray(value.plugins)) {
    throw new Error('Unsupported or malformed marketplace feed')
  }
  const deduplicated = new Map()
  for (const plugin of value.plugins) {
    if (plugin === null || typeof plugin !== 'object') throw new Error('Malformed plugin entry')
    for (const key of ['id', 'name', 'description', 'version', 'source', 'license']) {
      if (typeof plugin[key] !== 'string' || plugin[key] === '') throw new Error(`Plugin entry is missing ${key}`)
    }
    const source = canonicalSource(plugin.source)
    if (source !== plugin.source) throw new Error(`Plugin ${plugin.id} uses a non-canonical source`)
    const identity = `${source}\u0000${plugin.id}`
    if (!deduplicated.has(identity)) deduplicated.set(identity, plugin)
  }
  return [...deduplicated.values()]
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || 'CX'
}

function safeLink(value, fallback) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : fallback
  } catch {
    return fallback
  }
}

function render() {
  const query = search.value.trim().toLowerCase()
  const filtered = plugins.filter((plugin) => [
    plugin.id,
    plugin.name,
    plugin.description,
    plugin.source,
    ...(plugin.keywords ?? []),
    ...(plugin.authors ?? []).map(author => author.name),
  ].join('\n').toLowerCase().includes(query))
  count.textContent = `${filtered.length} of ${plugins.length} plugins`
  grid.replaceChildren()
  if (filtered.length === 0) {
    grid.append(create('div', 'empty', plugins.length === 0 ? 'No plugins are published yet.' : 'No plugins match this search.'))
    return
  }
  for (const plugin of filtered) {
    const card = create('article', 'plugin-card')
    const head = create('div', 'plugin-head')
    const icon = create('div', 'plugin-icon', initials(plugin.name))
    const title = create('div', 'plugin-title')
    title.append(create('h3', undefined, plugin.name), create('div', 'plugin-id', plugin.id))
    head.append(icon, title)
    card.append(head, create('p', 'plugin-description', plugin.description))
    const tags = create('div', 'plugin-tags')
    for (const keyword of plugin.keywords ?? []) tags.append(create('span', 'plugin-tag', keyword))
    tags.append(create('span', 'plugin-tag', `CordisX ${plugin.compatibility?.cordisx ?? 'unspecified'}`))
    card.append(tags)
    const meta = create('div', 'plugin-meta')
    const source = create('a', 'source-link', 'View source ↗')
    source.href = safeLink(plugin.homepage, safeLink(plugin.source, '#'))
    source.target = '_blank'
    source.rel = 'noreferrer'
    meta.append(create('span', undefined, `v${plugin.version} · ${plugin.license}`), source)
    card.append(meta)
    grid.append(card)
  }
}

async function load() {
  status.textContent = `Loading ${new URL(FEED_URL).hostname}…`
  status.dataset.error = 'false'
  try {
    const response = await fetch(FEED_URL, { headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`)
    plugins = validateFeed(await response.json())
    status.textContent = 'Validated marketplace feed v1'
    render()
  } catch (error) {
    status.dataset.error = 'true'
    status.textContent = error instanceof Error ? error.message : String(error)
    count.textContent = 'Feed unavailable'
    grid.replaceChildren(create('div', 'empty', 'The marketplace feed could not be loaded. Try again later or view the catalog on GitHub.'))
  }
}

search.addEventListener('input', render)
void load()
