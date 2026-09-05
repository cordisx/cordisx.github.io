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
    heroPrefix: 'Make your workspace',
    heroEmphasis: 'extensible.',
    getStarted: 'Get started',
    explorePlugins: 'Explore plugins',
    liveWorkspace: 'CordisX · Live workspace',
    liveExtensionMode: '02 / LIVE EXTENSION · LOCAL',
    ready: 'READY',
    reshapeComposer: 'Send a request to reshape this composer.',
    voiceRequest: 'Add a voice input button to the left of my send button.',
    sendRequest: 'Send request',
    marketplaceTitle: 'CordisX · Marketplace',
    marketplaceMode: '03 / INTERACTION CONCEPT · LOCAL',
    searchGraph: 'SEARCH THE EXTENSION GRAPH',
    findMissing: 'Find what your workspace is missing.',
    searchSeed: 'send button',
    pluginSearchQuery: 'Plugin search query',
    searchPlugins: 'Search plugins',
    liveQuery: 'LIVE QUERY',
    refiningQuery: 'The request is refining itself. Search when it feels right.',
    matchingPlugins: '3 MATCHING PLUGINS',
    conceptLocal: 'CONCEPT · LOCAL',
    composer: 'COMPOSER',
    partyDescription: 'Turn send into a celebration.',
    install: 'Install',
    input: 'INPUT',
    voiceInput: 'Voice Input',
    voiceDescription: 'Speak directly into the composer.',
    available: 'AVAILABLE',
    trace: 'TRACE',
    traceDescription: 'See every tool and task move.',
    partyReady: 'Party Popper is active. Try the send action.',
    launchRelease: 'Launch the release.',
    sendWithParty: 'Send with Party Popper',
    closePermission: 'Close permission request',
    conceptPreview: 'CONCEPT PREVIEW',
    previewParty: 'Preview Party Popper?',
    permissionCopy: 'This illustrates a future capability prompt. These permissions are not enforced today.',
    replaceSend: 'Replace the send action',
    renderEffects: 'Render celebration effects',
    currentConversation: 'current conversation only',
    saveSettings: 'Save plugin settings',
    localProfile: 'local profile',
    cancel: 'Cancel',
    previewActivation: 'Preview activation',
    actualProductUi: 'CORDISX / REAL CODEX DESKTOP',
    showcaseMotionTitle: 'Real CordisX flow',
    showcaseMotionDescription: 'A scripted walkthrough of the real Codex Host with a visible cursor.',
    showcaseWorkspaceTitle: 'Codex workspace',
    showcaseWorkspaceDescription: 'A signed-in, isolated Codex Desktop workspace launched by CordisX.',
    showcasePluginsTitle: 'Plugins',
    showcasePluginsDescription: 'Installed CordisX plugins inside the real Codex Manager.',
    showcaseExtensionPointsTitle: 'Extension points',
    showcaseExtensionPointsDescription: 'Every Host-owned surface available to plugins.',
    showcaseRoutesTitle: 'Routes',
    showcaseRoutesDescription: 'Plugin pages and navigation registered in the real Host.',
    showcaseMarketplaceTitle: 'Marketplace',
    showcaseMarketplaceDescription: 'The real local Marketplace view running inside CordisX Manager.',
    showcaseMotionAlt: 'A real CordisX workflow inside Codex Desktop',
    showcaseWorkspaceAlt: 'Signed-in Codex Desktop workspace launched by CordisX',
    showcasePluginsAlt: 'CordisX Manager plugins page inside Codex Desktop',
    showcaseExtensionPointsAlt: 'CordisX extension points inside Codex Desktop',
    showcaseRoutesAlt: 'CordisX plugin routes inside Codex Desktop',
    showcaseMarketplaceAlt: 'CordisX Marketplace inside Codex Desktop',
    showcaseChoices: 'Choose a Codex Desktop interface',
    showMotion: 'Show the real CordisX flow',
    showWorkspace: 'Show Codex workspace',
    showPlugins: 'Show plugins',
    showExtensionPoints: 'Show extension points',
    showRoutes: 'Show routes',
    showMarketplace: 'Show Marketplace',
    previousInterface: 'Previous product interface',
    nextInterface: 'Next product interface',
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
    heroPrefix: '让你的工作区',
    heroEmphasis: '自由扩展。',
    getStarted: '开始使用',
    explorePlugins: '探索插件',
    liveWorkspace: 'CordisX · 实时工作区',
    liveExtensionMode: '02 / 实时扩展 · 本地',
    ready: '就绪',
    reshapeComposer: '发送一个请求，让这个输入区变成你想要的样子。',
    voiceRequest: '在发送按钮左侧增加一个语音输入按钮。',
    sendRequest: '发送请求',
    marketplaceTitle: 'CordisX · 插件市场',
    marketplaceMode: '03 / 交互概念 · 本地',
    searchGraph: '搜索扩展能力',
    findMissing: '找到你的工作区还缺少的那块能力。',
    searchSeed: '发送按钮',
    pluginSearchQuery: '插件搜索词',
    searchPlugins: '搜索插件',
    liveQuery: '实时搜索',
    refiningQuery: '搜索词正在自动调整，合适时点击搜索。',
    matchingPlugins: '3 个匹配插件',
    conceptLocal: '概念 · 本地',
    composer: '输入区',
    partyDescription: '让每次发送都像一次庆祝。',
    install: '安装',
    input: '输入',
    voiceInput: '语音输入',
    voiceDescription: '直接对着输入区说话。',
    available: '可用',
    trace: '追踪',
    traceDescription: '查看每一次工具调用和任务流转。',
    partyReady: '礼花发送已启用，试试发送按钮。',
    launchRelease: '发布这一版。',
    sendWithParty: '使用礼花按钮发送',
    closePermission: '关闭权限请求',
    conceptPreview: '概念预览',
    previewParty: '预览礼花发送？',
    permissionCopy: '这里演示未来的能力授权提示；当前版本尚未强制执行这些权限。',
    replaceSend: '替换发送操作',
    renderEffects: '渲染庆祝效果',
    currentConversation: '仅限当前对话',
    saveSettings: '保存插件设置',
    localProfile: '本地配置',
    cancel: '取消',
    previewActivation: '预览启用效果',
    actualProductUi: 'CORDISX / 真实 CODEX DESKTOP',
    showcaseMotionTitle: '真实 CordisX 流程',
    showcaseMotionDescription: '带可见光标演示真实 Codex Host 中的 CordisX 操作流程。',
    showcaseWorkspaceTitle: 'Codex 工作区',
    showcaseWorkspaceDescription: '由 CordisX 启动的已登录、隔离 Codex Desktop 工作区。',
    showcasePluginsTitle: '插件',
    showcasePluginsDescription: '真实 CordisX 管理器中的已安装插件。',
    showcaseExtensionPointsTitle: '扩展点',
    showcaseExtensionPointsDescription: '查看插件可使用的所有 Host 界面扩展点。',
    showcaseRoutesTitle: '路由',
    showcaseRoutesDescription: '查看注册到真实 Host 的插件页面和导航。',
    showcaseMarketplaceTitle: '插件市场',
    showcaseMarketplaceDescription: '运行在 CordisX 管理器中的真实本地插件市场。',
    showcaseMotionAlt: 'Codex Desktop 中真实运行的 CordisX 操作流程',
    showcaseWorkspaceAlt: '由 CordisX 启动的已登录 Codex Desktop 工作区',
    showcasePluginsAlt: 'Codex Desktop 中的 CordisX 管理器插件页面',
    showcaseExtensionPointsAlt: 'Codex Desktop 中的 CordisX 扩展点页面',
    showcaseRoutesAlt: 'Codex Desktop 中的 CordisX 插件路由页面',
    showcaseMarketplaceAlt: 'Codex Desktop 中的 CordisX 插件市场页面',
    showcaseChoices: '选择 Codex Desktop 界面',
    showMotion: '显示真实 CordisX 流程',
    showWorkspace: '显示 Codex 工作区',
    showPlugins: '显示插件',
    showExtensionPoints: '显示扩展点',
    showRoutes: '显示路由',
    showMarketplace: '显示插件市场',
    previousInterface: '上一张产品界面',
    nextInterface: '下一张产品界面',
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

let locale = localStorageValue(STORAGE_LOCALE) || ((navigator.language || '').startsWith('zh') ? 'zh-CN' : 'en')
const storedTheme = localStorageValue(STORAGE_THEME)
let followsSystemTheme = storedTheme !== 'light' && storedTheme !== 'dark'
let theme = followsSystemTheme ? (systemTheme.matches ? 'light' : 'dark') : storedTheme

function localStorageValue(key) {
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
  document.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = copy(element.dataset.i18n)
  })
  document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
    element.setAttribute('aria-label', copy(element.dataset.i18nAriaLabel))
  })
  document.querySelectorAll('[data-i18n-alt]').forEach(element => {
    element.setAttribute('alt', copy(element.dataset.i18nAlt))
  })
  document.querySelectorAll('[data-i18n-value]').forEach(element => {
    element.value = copy(element.dataset.i18nValue)
  })
  document.querySelectorAll('[data-i18n-data-text]').forEach(element => {
    element.dataset.text = copy(element.dataset.i18nDataText)
  })
  document.querySelectorAll('[data-i18n-showcase-title]').forEach(element => {
    element.dataset.showcaseTitle = copy(element.dataset.i18nShowcaseTitle)
  })
  document.querySelectorAll('[data-i18n-showcase-description]').forEach(element => {
    element.dataset.showcaseDescription = copy(element.dataset.i18nShowcaseDescription)
  })
  localeToggle.querySelector('[data-locale-label]').textContent = copy('languageName')
  localeToggle.setAttribute('aria-label', copy('languageAction'))
  localeToggle.title = copy('languageAction')
  applyShowcaseAssets()
}

function applyTheme() {
  document.documentElement.dataset.theme = theme
  themeColor.content = theme === 'light' ? '#e4e4e7' : '#1b1c20'
  themeToggle.querySelector('[data-theme-label]').textContent = followsSystemTheme ? copy('system') : copy(theme)
  themeToggle.setAttribute('aria-label', copy('themeAction'))
  themeToggle.title = copy('themeAction')
  applyShowcaseAssets()
}

function applyShowcaseAssets() {
  const language = locale === 'zh-CN' ? 'Zh' : 'En'
  const appearance = theme === 'light' ? 'Light' : 'Dark'
  const key = `showcaseSrc${language}${appearance}`
  document.querySelectorAll('.showcase-slide').forEach(media => {
    if (media instanceof HTMLVideoElement) {
      const poster = media.dataset[`showcasePoster${language}${appearance}`]
      const webm = media.dataset[`showcaseVideo${language}${appearance}Webm`]
      const mp4 = media.dataset[`showcaseVideo${language}${appearance}Mp4`]
      let changed = false
      if (poster && media.getAttribute('poster') !== poster) media.setAttribute('poster', poster)
      for (const [type, source] of [['video/webm', webm], ['video/mp4', mp4]]) {
        const element = media.querySelector(`source[type="${type}"]`)
        if (element && source && element.getAttribute('src') !== source) {
          element.setAttribute('src', source)
          changed = true
        }
      }
      if (changed) {
        media.load()
        if (media.classList.contains('is-active') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          void media.play().catch(() => {})
        }
      }
      return
    }
    const source = media.dataset[key]
    if (source && media.getAttribute('src') !== source) media.setAttribute('src', source)
  })
}

localeToggle.addEventListener('click', () => {
  locale = locale === 'en' ? 'zh-CN' : 'en'
  storeValue(STORAGE_LOCALE, locale)
  window.location.reload()
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
