import { readFile, writeFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const check = process.argv.includes('--check')
const pages = [
  { file: 'index.html', active: 'product', githubHref: 'https://github.com/cordisx/cordisx' },
  { file: 'marketplace/index.html', active: 'marketplace', githubHref: 'https://github.com/cordisx/marketplace' },
  {
    file: 'marketplace/plugin/index.html',
    active: 'marketplace',
    githubHref: 'https://github.com/cordisx/marketplace',
  },
]

const templates = {
  header: await readFile(new URL('components/site-header.html', root), 'utf8'),
  footer: await readFile(new URL('components/site-footer.html', root), 'utf8'),
}

function render(template, values) {
  const result = template.trim().replaceAll(/\{\{([a-zA-Z]+)\}\}/gu, (_, key) => {
    if (!(key in values)) throw new Error(`unknown site component value ${key}`)
    return values[key]
  })
  if (result.includes('{{')) throw new Error('site component has an unresolved value')
  return result
}

function indent(value, spaces = 6) {
  const prefix = ' '.repeat(spaces)
  return value.split('\n').map(line => line.length === 0 ? '' : `${prefix}${line}`).join('\n')
}

function replaceComponent(source, name, rendered) {
  const start = `      <!-- site-${name}:start -->`
  const end = `      <!-- site-${name}:end -->`
  const region = `${start}\n${indent(rendered)}\n${end}`
  const marked = new RegExp(`${start}[\\s\\S]*?${end}`, 'u')
  if (marked.test(source)) return source.replace(marked, region)
  const legacy = name === 'header'
    ? /      <header class="site-header">[\s\S]*?      <\/header>/u
    : /      <footer class="site-footer"[\s\S]*?      <\/footer>/u
  if (!legacy.test(source)) throw new Error(`missing site ${name} region`)
  return source.replace(legacy, region)
}

const stale = []
for (const page of pages) {
  const url = new URL(page.file, root)
  const source = await readFile(url, 'utf8')
  const values = {
    githubHref: page.githubHref,
    productCurrent: page.active === 'product' ? ' aria-current="page"' : '',
    marketplaceCurrent: page.active === 'marketplace' ? ' aria-current="page"' : '',
  }
  const rendered = replaceComponent(
    replaceComponent(source, 'header', render(templates.header, values)),
    'footer',
    render(templates.footer, values),
  )
  if (rendered === source) continue
  if (check) stale.push(page.file)
  else await writeFile(url, rendered)
}

if (stale.length > 0) throw new Error(`generated site components are stale: ${stale.join(', ')}`)
