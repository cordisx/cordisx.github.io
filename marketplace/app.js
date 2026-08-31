import { hydrateReicons } from '../reicons.js'

const FEED_URL = 'https://raw.githubusercontent.com/cordisx/marketplace/main/marketplace.json'

const grid = document.querySelector('#plugin-grid')
const search = document.querySelector('#plugin-search')
const localeToggle = document.querySelector('#locale-toggle')
const themeToggle = document.querySelector('#theme-toggle')
const themeColor = document.querySelector('meta[name="theme-color"]')

const STORAGE_LOCALE = 'cordisx:locale'
const STORAGE_THEME = 'cordisx:theme'
const systemTheme = matchMedia('(prefers-color-scheme: light)')
const translations = {
  en: {
    product: 'Product',
    docs: 'Docs',
    marketplace: 'Marketplace',
    protocol: 'Protocol',
    homeLabel: 'CordisX home',
    searchLabel: 'Search community plugins',
    searchPlaceholder: 'Search plugins, authors, or keywords',
    loading: 'Loading plugins…',
    empty: 'No plugins are published yet.',
    noMatches: 'No plugins match this search.',
    loadError: 'The marketplace feed could not be loaded.',
    details: 'Details',
    source: 'Source',
    footerIntro: 'An extensible layer for the AI coding workspace you already trust.',
    footerTitle: 'Unofficial, local, and opt-in.',
    footerDescription: 'CordisX brings plugins into Codex Desktop without replacing your tools, projects, conversations, or agent loop.',
    footerSafety: 'Plugins currently run as trusted renderer code. Sandboxing, signed packages, and enforced permissions are not yet available—review source before enabling an extension.',
    copyright: '© 2026 CordisX. Open source.',
    preferencesLabel: 'Display preferences',
    languageName: 'EN',
    languageAction: 'Switch language to Chinese',
    system: 'System',
    dark: 'Dark',
    light: 'Light',
    themeAction: 'Switch color theme',
  },
  'zh-CN': {
    product: '产品',
    docs: '文档',
    marketplace: '插件市场',
    protocol: '协议',
    homeLabel: '返回 CordisX 首页',
    searchLabel: '搜索社区插件',
    searchPlaceholder: '搜索插件、作者或关键词',
    loading: '正在加载插件…',
    empty: '暂时还没有已发布的插件。',
    noMatches: '没有匹配当前搜索的插件。',
    loadError: '插件市场数据加载失败。',
    details: '详情',
    source: '源码',
    footerIntro: '为你已经信任的 AI 编程工作区增加可扩展能力。',
    footerTitle: '非官方、本地运行、由你启用。',
    footerDescription: 'CordisX 将插件带入 Codex Desktop，同时保留你现有的工具、项目、对话和智能体工作流。',
    footerSafety: '插件目前以受信任的渲染器代码运行，暂不提供沙箱、签名包或强制权限控制；启用扩展前请先审查源码。',
    copyright: '© 2026 CordisX。开源项目。',
    preferencesLabel: '显示偏好',
    languageName: '中文',
    languageAction: '切换语言为英文',
    system: '跟随系统',
    dark: '深色',
    light: '浅色',
    themeAction: '切换颜色主题',
  },
}

let plugins = []
let feedFallbackLocale = 'en'
let locale = storedValue(STORAGE_LOCALE) || ((navigator.language || '').startsWith('zh') ? 'zh-CN' : 'en')
const storedTheme = storedValue(STORAGE_THEME)
let followsSystemTheme = storedTheme !== 'light' && storedTheme !== 'dark'
let theme = followsSystemTheme ? (systemTheme.matches ? 'light' : 'dark') : storedTheme

function storedValue(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function storeValue(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

function clearValue(key) {
  try {
    localStorage.removeItem(key)
  } catch {}
}

function copy(key) {
  return translations[locale]?.[key] ?? translations.en[key] ?? key
}

function applyLocale() {
  document.documentElement.lang = locale
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = copy(element.dataset.i18n)
  }
  for (const element of document.querySelectorAll('[data-i18n-placeholder]')) {
    element.placeholder = copy(element.dataset.i18nPlaceholder)
  }
  for (const element of document.querySelectorAll('[data-i18n-aria-label]')) {
    element.setAttribute('aria-label', copy(element.dataset.i18nAriaLabel))
  }
  localeToggle.querySelector('[data-locale-label]').textContent = copy('languageName')
  localeToggle.setAttribute('aria-label', copy('languageAction'))
  localeToggle.title = copy('languageAction')
  if (plugins.length > 0) render()
}

function applyTheme() {
  document.documentElement.dataset.theme = theme
  themeColor.content = theme === 'light' ? '#e7e7e4' : '#1b1c20'
  themeToggle.querySelector('[data-theme-label]').textContent = followsSystemTheme ? copy('system') : copy(theme)
  themeToggle.setAttribute('aria-label', copy('themeAction'))
  themeToggle.title = copy('themeAction')
}

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
  for (const candidate of [locale, ...(navigator.languages ?? []), navigator.language, feedFallbackLocale]) {
    if (typeof candidate !== 'string' || candidate === '') continue
    if (!candidates.includes(candidate)) candidates.push(candidate)
    const language = candidate.split('-')[0]
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
  const detail = create('a', 'catalog-card-detail')
  detail.href = `/marketplace/plugin/?id=${encodeURIComponent(plugin.id)}`
  detail.setAttribute('aria-label', `${copy('details')}: ${plugin.name}`)
  const head = create('div', 'catalog-card-head')
  const icon = create('div', 'catalog-card-icon', initials(plugin.name))
  const title = create('div', 'catalog-card-title')
  title.append(create('h3', undefined, plugin.name), create('div', 'catalog-card-id', plugin.id))
  head.append(icon, title)
  detail.append(head, create('p', 'catalog-card-description', plugin.description))

  const tags = create('div', 'catalog-tags')
  for (const keyword of (plugin.keywords ?? []).slice(0, 3)) tags.append(create('span', 'catalog-tag', keyword))
  tags.append(create('span', 'catalog-tag', `CordisX ${plugin.compatibility?.cordisx ?? 'unspecified'}`))
  detail.append(tags)
  card.append(detail)

  const meta = create('div', 'catalog-card-meta')
  const source = create('a', 'catalog-source')
  source.href = safeLink(plugin.homepage, safeLink(plugin.source, '#'))
  source.target = '_blank'
  source.rel = 'noreferrer'
  source.append(create('span', undefined, copy('source')), iconSlot('ArrowUpRight', 12))
  const details = create('a', 'catalog-source')
  details.href = detail.href
  details.append(create('span', undefined, copy('details')), iconSlot('ArrowRight', 12))
  const links = create('span', 'catalog-card-links')
  links.append(source, details)
  meta.append(create('span', undefined, `v${plugin.version} · ${plugin.license}`), links)
  card.append(meta)
  return card
}

function render() {
  const query = search.value.trim().toLocaleLowerCase()
  const filtered = plugins
    .map(localizedPlugin)
    .filter(plugin => searchableText(plugin).includes(query))

  grid.replaceChildren()

  if (filtered.length === 0) {
    grid.append(create('div', 'catalog-empty', plugins.length === 0 ? copy('empty') : copy('noMatches')))
    return
  }

  for (const plugin of filtered) grid.append(renderCard(plugin))
  hydrateReicons(grid)
}

async function load() {
  try {
    const [response] = await Promise.all([
      fetch(FEED_URL, { headers: { accept: 'application/json' } }),
      new Promise(resolve => setTimeout(resolve, 1800)),
    ])
    if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`)
    plugins = validateFeed(await response.json())
    render()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    grid.replaceChildren(create('div', 'catalog-empty', `${copy('loadError')} ${message}`))
  } finally {
    grid.setAttribute('aria-busy', 'false')
    search.disabled = false
  }
}

search.addEventListener('input', render)
localeToggle.addEventListener('click', () => {
  locale = locale === 'en' ? 'zh-CN' : 'en'
  storeValue(STORAGE_LOCALE, locale)
  applyLocale()
  applyTheme()
})
themeToggle.addEventListener('click', () => {
  if (followsSystemTheme) {
    followsSystemTheme = false
    theme = 'dark'
    storeValue(STORAGE_THEME, theme)
  } else if (theme === 'dark') {
    theme = 'light'
    storeValue(STORAGE_THEME, theme)
  } else {
    followsSystemTheme = true
    theme = systemTheme.matches ? 'light' : 'dark'
    clearValue(STORAGE_THEME)
  }
  applyTheme()
})

systemTheme.addEventListener('change', event => {
  if (!followsSystemTheme) return
  theme = event.matches ? 'light' : 'dark'
  applyTheme()
})
applyLocale()
applyTheme()
hydrateReicons()
void load()
