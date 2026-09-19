function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || 'CX'
}

export function createPluginIcon(plugin, className) {
  const icon = document.createElement('div')
  icon.className = className
  icon.setAttribute('aria-hidden', 'true')
  icon.textContent = initials(plugin.name)

  let url
  try {
    if (typeof plugin.icon !== 'string') return icon
    url = new URL(plugin.icon)
    if (url.protocol !== 'https:' || url.username || url.password) return icon
  } catch {
    return icon
  }

  const image = document.createElement('img')
  image.className = 'catalog-plugin-image'
  image.alt = ''
  image.decoding = 'async'
  image.referrerPolicy = 'no-referrer'
  image.addEventListener('load', () => icon.replaceChildren(image), { once: true })
  image.addEventListener('error', () => {
    icon.textContent = initials(plugin.name)
  }, { once: true })
  image.src = url.href
  return icon
}
