import { access, readFile } from 'node:fs/promises'
import { selectPlaybackTimeline } from './ai-plugin-demo-playback.mjs'

const homepage = await readFile(new URL('../index.html', import.meta.url), 'utf8')
const homepageStyles = await readFile(new URL('../styles.css', import.meta.url), 'utf8')
const homepagePreferences = await readFile(new URL('../preferences.js', import.meta.url), 'utf8')
const homepageMarketplace = await readFile(new URL('../marketplace.js', import.meta.url), 'utf8')
const shell = await readFile(new URL('../site-shell.css', import.meta.url), 'utf8')
const marketplace = await readFile(new URL('../marketplace/index.html', import.meta.url), 'utf8')
const marketplaceStyles = await readFile(new URL('../marketplace/styles.css', import.meta.url), 'utf8')
const marketplaceScript = await readFile(new URL('../marketplace/app.js', import.meta.url), 'utf8')
const pluginDetail = await readFile(new URL('../marketplace/plugin/index.html', import.meta.url), 'utf8')
const pluginDetailStyles = await readFile(new URL('../marketplace/plugin/styles.css', import.meta.url), 'utf8')
const pluginDetailScript = await readFile(new URL('../marketplace/plugin/app.js', import.meta.url), 'utf8')
const reicons = await readFile(new URL('../reicons.js', import.meta.url), 'utf8')
const products = await readFile(new URL('../products.yaml', import.meta.url), 'utf8')
const aiPluginScene = await readFile(new URL('./ai-plugin-demo-scene.mjs', import.meta.url), 'utf8')
const aiPluginPlayback = await readFile(new URL('./ai-plugin-demo-playback.mjs', import.meta.url), 'utf8')
const aiPluginCapture = await readFile(new URL('./capture-ai-plugin-demo.mjs', import.meta.url), 'utf8')
const aiPluginWorkflow = await readFile(new URL('../.agents/docs/ai-plugin-demo-capture.md', import.meta.url), 'utf8')

for (const [file, content, references] of [
  ['index.html', homepage, ['./site-shell.css', './styles.css', './preferences.js', './showcase.js', '/docs/', '/marketplace/', 'class="site-footer"', 'data-showcase', 'REAL CODEX DESKTOP', 'id="locale-toggle"', 'id="theme-toggle"']],
  ['marketplace/index.html', marketplace, ['../site-shell.css', './styles.css', './app.js', '../brand-animation.js', 'id="plugin-grid"', 'id="plugin-search"', 'aria-current="page"', 'class="site-footer"', 'class="catalog-loading"', 'data-cordisx-animation="one-shot"', '../cordisx-mark-animated-dark.svg', 'id="locale-toggle"', 'id="theme-toggle"']],
  ['marketplace/plugin/index.html', pluginDetail, ['/site-shell.css', '/marketplace/styles.css', './styles.css', './app.js', 'id="plugin-detail"', 'id="locale-toggle"', 'id="theme-toggle"']],
  ['site-shell.css', shell, ['width: min(1040px, 100%)', 'height: 76px', '.site-header::before', '.site-footer', 'padding: 72px 24px 34px', 'padding: 56px 18px 30px']],
]) {
  for (const reference of references) {
    if (!content.includes(reference)) throw new Error(`${file} is missing ${reference}`)
  }
}

if (!marketplaceScript.includes('https://raw.githubusercontent.com/cordisx/marketplace/main/marketplace.json')) {
  throw new Error('marketplace app does not reference the official feed')
}
if (!marketplaceScript.includes('/marketplace/plugin/?id=')) throw new Error('marketplace cards must link to plugin details')
if (!pluginDetailScript.includes('https://raw.githubusercontent.com/cordisx/marketplace/main/marketplace.json')) {
  throw new Error('plugin detail does not reference the official feed')
}
if (!pluginDetailScript.includes("'cordisx:locale'") || !pluginDetailScript.includes("'cordisx:theme'")) {
  throw new Error('plugin detail display preferences must be persistent')
}
if (!pluginDetailScript.includes('prefers-color-scheme: light')) {
  throw new Error('plugin detail must follow the system theme by default')
}
if (!pluginDetailStyles.includes(':root[data-theme="light"]')) {
  throw new Error('plugin detail must provide a light color theme')
}
if (!marketplaceScript.includes("'cordisx:locale'") || !marketplaceScript.includes("'cordisx:theme'")) {
  throw new Error('marketplace display preferences must be persistent')
}
if (!marketplaceStyles.includes(':root[data-theme="light"]')) {
  throw new Error('marketplace must provide a light color theme')
}
if (!homepagePreferences.includes("'cordisx:locale'") || !homepagePreferences.includes("'cordisx:theme'")) {
  throw new Error('homepage display preferences must be persistent')
}
if (!homepagePreferences.includes('prefers-color-scheme: light') || !marketplaceScript.includes('prefers-color-scheme: light')) {
  throw new Error('homepage and marketplace must follow the system theme by default')
}
if (!homepageStyles.includes(':root[data-theme="light"]')) {
  throw new Error('homepage must provide a light color theme')
}
if (!homepageStyles.includes(':root[data-theme="light"] .site-header') || !homepageStyles.includes('background: #e4e4e7')) {
  throw new Error('homepage light body must match the rendered header canvas')
}
if (!homepageStyles.includes('aspect-ratio: 2560 / 1640') || !homepageStyles.includes('object-fit: contain')) {
  throw new Error('homepage showcase must display the complete real Codex screenshots')
}
if (!homepage.includes('data-i18n-alt="showcaseWorkspaceAlt"') || !homepage.includes('data-i18n-aria-label="showcaseChoices"')) {
  throw new Error('homepage showcase media and controls must be localized')
}
if ((homepage.match(/class="showcase-slide(?: is-active)?"/g) ?? []).length !== 6 || !homepage.includes('<b data-showcase-index>01</b> / 06')) {
  throw new Error('homepage showcase must contain the real workflow and five real Codex interfaces')
}
for (const language of ['en', 'zh']) {
  for (const theme of ['dark', 'light']) {
    for (const extension of ['webm', 'mp4']) {
      if (!homepage.includes(`assets/motion/cordisx-real-workflow-${language}-${theme}.${extension}`)) {
        throw new Error(`homepage showcase is missing the ${language}/${theme} real Codex workflow video`)
      }
      await access(new URL(`../assets/motion/cordisx-real-workflow-${language}-${theme}.${extension}`, import.meta.url))
    }
  }
}
if (!homepagePreferences.includes('showcaseVideo${language}${appearance}Webm') || !homepagePreferences.includes('showcaseVideo${language}${appearance}Mp4')) {
  throw new Error('homepage preferences must switch showcase video sources by locale and theme')
}
if (!homepagePreferences.includes("theme === 'light' ? '#e4e4e7'")) {
  throw new Error('homepage theme color must match the light outer canvas')
}
if (homepage.includes('market-chat-plugin-state') || homepage.includes('partyActive') || homepage.includes('conceptOnly')) {
  throw new Error('party demo must not include the removed preview state banner')
}
if (!homepageMarketplace.includes("partyInput.textContent = ''") || !homepageMarketplace.includes('partyButton.disabled = true')) {
  throw new Error('party demo must clear the request and disable empty sends')
}
if (!marketplaceScript.includes('value.schemaVersion !== 3') || !marketplaceScript.includes('plugin.schemaVersion !== 3')) {
  throw new Error('marketplace app does not validate marketplace feed v3')
}
if (marketplaceScript.includes('.innerHTML')) throw new Error('marketplace app must not inject catalog HTML')
if (/\b(?:Install|Allow permissions)\b/.test(marketplace)) {
  throw new Error('production marketplace must remain read-only discovery')
}
if (
  marketplace.includes('marketplace-hero') ||
  marketplaceStyles.includes('.marketplace-hero') ||
  !/<main>\s*<section class="catalog-section"(?:\s|>)/.test(marketplace) ||
  marketplace.includes('class="catalog-heading"') ||
  marketplace.includes('class="catalog-boundary"') ||
  marketplace.includes('id="feed-status"') ||
  marketplace.includes('id="plugin-count"') ||
  !marketplaceStyles.includes('padding: 24px 24px 78px') ||
  !marketplaceStyles.includes('margin-top: 16px') ||
  !marketplaceStyles.includes('.catalog-shell {\n  width: 100%') ||
  !marketplaceStyles.includes('min-height: calc(100svh - 75px)') ||
  !marketplaceStyles.includes('min-height: calc(100svh - 67px)')
) {
  throw new Error('marketplace must open directly on the catalog surface')
}
if (reicons.includes('unpkg.com')) throw new Error('public site icons must load from the vendored Reicon modules')
if (!shell.includes('.site-header nav a[href="/#product"],') || !shell.includes('.site-header nav .github-link')) {
  throw new Error('mobile navigation must preserve the Docs and Marketplace links')
}
if (shell.includes('.site-header nav a:not(.github-link)')) {
  throw new Error('mobile navigation must not hide the Docs and Marketplace links')
}
if (homepage.includes('LOCAL + VERIFIED')) throw new Error('interaction concepts must not claim verification')
if (!homepage.includes('unofficial, local, opt-in extension host')) {
  throw new Error('homepage metadata must state the CordisX trust boundary')
}
if ((homepage + marketplace).includes('/cordisx/main/packages/cli/assets/brand/')) {
  throw new Error('brand assets must be pinned to an immutable CordisX revision')
}
if (!products.includes('https://github.com/cordisx/marketplace')) throw new Error('products.yaml is missing marketplace')
if (!aiPluginScene.includes('我要发送按钮在点击的时候全屏放礼花。')) {
  throw new Error('AI plugin demo scene is missing the exact Chinese request')
}
if (!aiPluginScene.includes('Make the send button launch full-screen confetti when clicked.')) {
  throw new Error('AI plugin demo scene is missing the exact English request')
}
if (!aiPluginPlayback.includes('sourceFrame') || !aiPluginPlayback.includes('encodedElapsedMs')) {
  throw new Error('AI plugin playback helper is missing auditable source/encoded frame mapping')
}
if (!aiPluginScene.includes("'codex-builds-and-cordisx-loads': 5")) {
  throw new Error('AI plugin demo scene is missing the exact 5x Agent work rate')
}
const playbackProbe = selectPlaybackTimeline(
  Array.from({ length: 9 }, (_, frame) => ({ frame, segment: frame < 7 ? 'work' : 'finish', sourceElapsedMs: frame * 500 })),
  { work: 5 },
  12,
)
if (playbackProbe.sourceFrameCount !== 9
  || playbackProbe.frameCount !== 5
  || playbackProbe.timeline.map(item => item.sourceFrame).join(',') !== '0,5,6,7,8') {
  throw new Error('AI plugin playback helper does not preserve accelerated boundaries')
}
for (const truthMarker of [
  "rendererUrl: 'app://-/index.html'",
  "option('--theme', aiPluginDemoScene.theme)",
  "option('--language', 'zh')",
  "execFileSync(process.execPath, [creatorEntry, 'send-confetti']",
  'generationChanged: replacement.replacementGeneration !== baselineGeneration',
  'finalSubmitClicked: true',
  'effectObserved: true',
  'openScaffoldedPluginDetails(send, recorder)',
  'materializePlaybackFrames(recorder.timeline)',
  "`${outputBasename}.plugin.tsx`",
  "'-movflags', '+faststart'",
  'palettegen=max_colors=',
  "'-pix_fmt', scene.output.pixelFormat",
]) {
  if (!aiPluginCapture.includes(truthMarker)) throw new Error(`AI plugin capture is missing ${truthMarker}`)
}
if (!aiPluginWorkflow.includes('Do not replace the Codex shell') || !aiPluginWorkflow.includes('Dry run never reads authentication')) {
  throw new Error('AI plugin capture workflow is missing its truth or privacy boundary')
}
await access(new URL('../scripts/fixtures/ai-plugin-demo/AGENTS.md', import.meta.url))
for (const language of ['en', 'zh']) {
  for (const theme of ['dark', 'light']) {
    for (const extension of ['gif', 'json', 'mp4', 'plugin.tsx', 'webm']) {
      await access(new URL(`../assets/motion/cordisx-ai-plugin-demo-${language}-${theme}.${extension}`, import.meta.url))
    }
    await access(new URL(`../assets/screenshots/cordisx-ai-plugin-demo-${language}-${theme}.png`, import.meta.url))
  }
}

for (const icon of [
  'Activity',
  'ArrowRight',
  'ArrowUp',
  'ArrowUpRight',
  'BookOpen',
  'BoxAdd',
  'ChatRoundDots',
  'Check',
  'Code',
  'Confetti',
  'Download',
  'Globe',
  'Microphone',
  'Search',
  'ShieldCheck',
  'Store',
  'Xmark',
]) {
  await access(new URL(`../assets/reicon/icons/${icon}.js`, import.meta.url))
}
await access(new URL('../cordisx-mark-animated-dark.svg', import.meta.url))
await access(new URL('../assets/reicon/LICENSE', import.meta.url))
await access(new URL('../assets/capture/cordisx-profile-avatar.png', import.meta.url))
await access(new URL('../assets/capture/cordisx-motion-cursor.svg', import.meta.url))
await access(new URL('../assets/screenshots/codex-real-manager.png', import.meta.url))
await access(new URL('../assets/screenshots/codex-real-extension-points.png', import.meta.url))
await access(new URL('../assets/screenshots/codex-workspace-real.png', import.meta.url))
await access(new URL('../assets/screenshots/codex-workspace-real-light.png', import.meta.url))
await access(new URL('../assets/motion/cordisx-real-workflow.mp4', import.meta.url))
await access(new URL('../assets/motion/cordisx-real-workflow.webm', import.meta.url))
await access(new URL('../assets/motion/cordisx-real-workflow.gif', import.meta.url))
for (const locale of ['en', 'zh']) {
  for (const theme of ['light', 'dark']) {
    for (const page of ['plugins', 'extension-points', 'routes', 'marketplace']) {
      await access(new URL(`../assets/screenshots/cordisx-manager-${page}-${locale}-${theme}.png`, import.meta.url))
    }
  }
}

console.log('homepage and marketplace checks passed')
