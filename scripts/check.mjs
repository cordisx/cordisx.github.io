import { readFile } from 'node:fs/promises'

const index = await readFile(new URL('../marketplace/index.html', import.meta.url), 'utf8')
const script = await readFile(new URL('../marketplace/app.js', import.meta.url), 'utf8')
const products = await readFile(new URL('../products.yaml', import.meta.url), 'utf8')

for (const reference of ['./styles.css', './app.js', './favicon.svg', 'id="plugin-grid"', 'id="plugin-search"']) {
  if (!index.includes(reference)) throw new Error(`marketplace/index.html is missing ${reference}`)
}
if (!script.includes('https://raw.githubusercontent.com/cordisx/marketplace/main/marketplace.json')) {
  throw new Error('marketplace app does not reference the official feed')
}
if (script.includes('.innerHTML')) throw new Error('marketplace app must not inject catalog HTML')
if (!products.includes('https://github.com/cordisx/marketplace')) throw new Error('products.yaml is missing marketplace')

console.log('homepage marketplace checks passed')
