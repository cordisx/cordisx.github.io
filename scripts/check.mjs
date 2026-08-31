import { access, readFile } from 'node:fs/promises'

const homepage = await readFile(new URL('../index.html', import.meta.url), 'utf8')
const homepageStyles = await readFile(new URL('../styles.css', import.meta.url), 'utf8')
const homepagePreferences = await readFile(new URL('../preferences.js', import.meta.url), 'utf8')
const shell = await readFile(new URL('../site-shell.css', import.meta.url), 'utf8')
const marketplace = await readFile(new URL('../marketplace/index.html', import.meta.url), 'utf8')
const marketplaceStyles = await readFile(new URL('../marketplace/styles.css', import.meta.url), 'utf8')
const marketplaceScript = await readFile(new URL('../marketplace/app.js', import.meta.url), 'utf8')
const reicons = await readFile(new URL('../reicons.js', import.meta.url), 'utf8')
const products = await readFile(new URL('../products.yaml', import.meta.url), 'utf8')

for (const [file, content, references] of [
  ['index.html', homepage, ['./site-shell.css', './styles.css', './preferences.js', './showcase.js', '/docs/', '/marketplace/', 'class="site-footer"', 'data-showcase', 'ACTUAL PRODUCT UI', 'id="locale-toggle"', 'id="theme-toggle"']],
  ['marketplace/index.html', marketplace, ['../site-shell.css', './styles.css', './app.js', '../brand-animation.js', 'id="plugin-grid"', 'id="plugin-search"', 'aria-current="page"', 'class="site-footer"', 'class="catalog-loading"', 'data-cordisx-animation="one-shot"', '../cordisx-mark-animated-dark.svg', 'id="locale-toggle"', 'id="theme-toggle"']],
  ['site-shell.css', shell, ['width: min(1040px, 100%)', 'height: 76px', '.site-header::before', '.site-footer', 'padding: 72px 24px 34px', 'padding: 56px 18px 30px']],
]) {
  for (const reference of references) {
    if (!content.includes(reference)) throw new Error(`${file} is missing ${reference}`)
  }
}

if (!marketplaceScript.includes('https://raw.githubusercontent.com/cordisx/marketplace/main/marketplace.json')) {
  throw new Error('marketplace app does not reference the official feed')
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
if (!homepageStyles.includes(':root[data-theme="light"]')) {
  throw new Error('homepage must provide a light color theme')
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
await access(new URL('../assets/screenshots/cordisx-agent-workspace.png', import.meta.url))
await access(new URL('../assets/screenshots/cordisx-plugin-manager.png', import.meta.url))
await access(new URL('../assets/screenshots/cordisx-plugin-settings.png', import.meta.url))
await access(new URL('../assets/screenshots/cordisx-permission-dialog.png', import.meta.url))

console.log('homepage and marketplace checks passed')
