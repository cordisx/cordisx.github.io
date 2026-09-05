import { hydrateReicons } from '/reicons.js'

const FEED_URL = 'https://raw.githubusercontent.com/cordisx/marketplace/main/marketplace.json'
const STORAGE_LOCALE = 'cordisx:locale'
const STORAGE_THEME = 'cordisx:theme'
const detail = document.querySelector('#plugin-detail')
const localeToggle = document.querySelector('#locale-toggle')
const themeToggle = document.querySelector('#theme-toggle')
const themeColor = document.querySelector('meta[name="theme-color"]')
const systemTheme = matchMedia('(prefers-color-scheme: light)')

const translations = {
  en: {
    product: 'Product',
    docs: 'Docs',
    marketplace: 'Marketplace',
    protocol: 'Protocol',
    homeLabel: 'CordisX home',
    loading: 'Loading plugin…',
    back: 'All plugins',
    source: 'Source',
    homepage: 'Homepage',
    about: 'About this plugin',
    metadata: 'Metadata',
    version: 'Version',
    compatibility: 'CordisX',
    license: 'License',
    authors: 'Authors',
    pluginId: 'Plugin ID',
    discoveryNote: 'This marketplace page presents published metadata. Review the source before enabling an extension.',
    missing: 'This plugin could not be found in the marketplace feed.',
    loadError: 'The plugin details could not be loaded.',
    footerIntro: 'An extensible layer for the AI coding workspace you already trust.',
    footerTitle: 'Unofficial, local, and opt-in.',
    footerDescription:
      'CordisX brings plugins into Codex Desktop without replacing your tools, projects, conversations, or agent loop.',
    footerSafety:
      'Plugins currently run as trusted renderer code. Sandboxing, signed packages, and enforced permissions are not yet available—review source before enabling an extension.',
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
    loading: '正在加载插件…',
    back: '全部插件',
    source: '源码',
    homepage: '主页',
    about: '关于这个插件',
    metadata: '插件信息',
    version: '版本',
    compatibility: 'CordisX',
    license: '许可证',
    authors: '作者',
    pluginId: '插件 ID',
    discoveryNote: '此详情页展示插件发布的元数据。启用扩展前请先审查源码。',
    missing: '插件市场数据源中找不到这个插件。',
    loadError: '插件详情加载失败。',
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

let plugin
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

function create(tag, className, text) {
  const element = document.createElement(tag)
  if (className) element.className = className
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

function safeLink(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || 'CX'
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

function localizedPlugin(value) {
  let localized
  for (const candidate of localeCandidates()) {
    if (value.localizations?.[candidate]) {
      localized = value.localizations[candidate]
      break
    }
  }
  return {
    ...value,
    name: localized?.name ?? value.name,
    description: localized?.description ?? value.description,
    keywords: localized?.keywords ?? value.keywords ?? [],
    authorNames: localized?.authors ?? (value.authors ?? []).map(author => author.name),
  }
}

function applyLocale() {
  document.documentElement.lang = locale
  document.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = copy(element.dataset.i18n)
  })
  document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
    element.setAttribute('aria-label', copy(element.dataset.i18nAriaLabel))
  })
  localeToggle.querySelector('[data-locale-label]').textContent = copy('languageName')
  localeToggle.setAttribute('aria-label', copy('languageAction'))
  localeToggle.title = copy('languageAction')
  if (plugin) renderPlugin()
}

function applyTheme() {
  document.documentElement.dataset.theme = theme
  themeColor.content = theme === 'light' ? '#e7e7e4' : '#1b1c20'
  themeToggle.querySelector('[data-theme-label]').textContent = followsSystemTheme ? copy('system') : copy(theme)
  themeToggle.setAttribute('aria-label', copy('themeAction'))
  themeToggle.title = copy('themeAction')
}

function actionLink(label, href, icon) {
  const link = create('a', 'plugin-detail-action')
  link.href = href
  link.target = '_blank'
  link.rel = 'noreferrer'
  link.append(create('span', undefined, label), iconSlot(icon, 13))
  return link
}

function metadataRow(term, value) {
  const row = create('div')
  row.append(create('dt', undefined, term), create('dd', undefined, value))
  return row
}

function renderPlugin() {
  const value = localizedPlugin(plugin)
  document.title = `CordisX — ${value.name}`

  const back = create('a', 'plugin-back')
  back.href = '/marketplace/'
  back.append(iconSlot('ArrowRight', 13), create('span', undefined, copy('back')))

  const hero = create('div', 'plugin-detail-hero')
  const icon = create('div', 'plugin-detail-icon', initials(value.name))
  const title = create('div', 'plugin-detail-title')
  title.append(
    create('h1', undefined, value.name),
    create('div', 'plugin-detail-id', value.id),
    create('p', 'plugin-detail-description', value.description),
  )
  const actions = create('div', 'plugin-detail-actions')
  const source = safeLink(value.source)
  const homepage = safeLink(value.homepage)
  if (source) actions.append(actionLink(copy('source'), source, 'ArrowUpRight'))
  if (homepage && homepage !== source) actions.append(actionLink(copy('homepage'), homepage, 'ArrowUpRight'))
  hero.append(icon, title, actions)

  const grid = create('div', 'plugin-detail-grid')
  const about = create('section', 'plugin-detail-panel')
  about.append(create('h2', undefined, copy('about')), create('p', 'plugin-detail-copy', copy('discoveryNote')))
  const tags = create('div', 'plugin-tags')
  for (const keyword of value.keywords ?? []) tags.append(create('span', 'catalog-tag', keyword))
  about.append(tags)

  const metadata = create('section', 'plugin-detail-panel')
  metadata.append(create('h2', undefined, copy('metadata')))
  const list = create('dl', 'plugin-metadata')
  list.append(
    metadataRow(copy('version'), value.version),
    metadataRow(copy('compatibility'), value.compatibility?.cordisx ?? '—'),
    metadataRow(copy('license'), value.license),
    metadataRow(copy('authors'), (value.authorNames ?? []).join(', ') || '—'),
    metadataRow(copy('pluginId'), value.id),
  )
  metadata.append(list)
  grid.append(about, metadata)

  detail.replaceChildren(back, hero, grid)
  detail.setAttribute('aria-busy', 'false')
  hydrateReicons(detail)
}

function renderError(message) {
  const error = create('div', 'plugin-detail-error')
  const content = create('div')
  content.append(create('p', undefined, message))
  const back = create('a', 'plugin-back', copy('back'))
  back.href = '/marketplace/'
  content.append(back)
  error.append(content)
  detail.replaceChildren(error)
  detail.setAttribute('aria-busy', 'false')
}

async function load() {
  try {
    const id = new URLSearchParams(location.search).get('id')
    if (!id) throw new Error(copy('missing'))
    const response = await fetch(FEED_URL, { headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const feed = await response.json()
    if (feed?.schemaVersion !== 3 || !Array.isArray(feed.plugins)) throw new Error('Unsupported marketplace feed')
    feedFallbackLocale = typeof feed.fallbackLocale === 'string' ? feed.fallbackLocale : 'en'
    plugin = feed.plugins.find(candidate => candidate?.schemaVersion === 3 && candidate.id === id)
    if (!plugin) throw new Error(copy('missing'))
    renderPlugin()
  } catch (error) {
    const message = error instanceof Error && (error.message === copy('missing') || error.message.startsWith('HTTP'))
      ? error.message
      : copy('loadError')
    renderError(message)
  }
}

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
