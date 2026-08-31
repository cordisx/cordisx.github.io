import { hydrateReicons } from './reicons.js?v=33'

const marketplace = document.querySelector('[data-marketplace-demo]')
const zh = document.documentElement.lang === 'zh-CN'
const copy = zh ? {
  searchTerms: ['发送按钮', '庆祝效果', '礼花按钮'],
  previewing: '正在预览…',
  liveWorkspace: 'CordisX · 实时工作区',
  partyMode: '概念 · 礼花发送',
} : {
  searchTerms: ['send button', 'celebration', 'party popper'],
  previewing: 'Previewing…',
  liveWorkspace: 'CordisX · Live workspace',
  partyMode: 'CONCEPT · PARTY POPPER',
}

if (marketplace instanceof HTMLElement) {
  const searchView = marketplace.querySelector('[data-market-search-view]')
  const searchForm = marketplace.querySelector('[data-market-search]')
  const searchInput = marketplace.querySelector('[data-market-search-input]')
  const searchButton = marketplace.querySelector('.market-search-button')
  const emptyState = marketplace.querySelector('[data-market-empty]')
  const results = marketplace.querySelector('[data-market-results]')
  const installButton = marketplace.querySelector('[data-install-party]')
  const overlay = marketplace.querySelector('[data-permission-overlay]')
  const allowButton = marketplace.querySelector('[data-allow-install]')
  const cancelButtons = marketplace.querySelectorAll('[data-cancel-install]')
  const chatView = marketplace.querySelector('[data-market-chat-view]')
  const marketplaceTitle = marketplace.querySelector('[data-marketplace-title]')
  const marketplaceMode = marketplace.querySelector('[data-marketplace-mode]')
  const partyComposer = marketplace.querySelector('[data-party-composer]')
  const partyButton = marketplace.querySelector('.party-send')
  const partyMessage = marketplace.querySelector('[data-party-message]')
  const partyHint = marketplace.querySelector('[data-party-hint]')
  const confettiLayer = marketplace.querySelector('[data-confetti-layer]')
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const wait = milliseconds => new Promise(resolve => window.setTimeout(resolve, prefersReducedMotion ? 0 : milliseconds))
  const searchTerms = copy.searchTerms
  let typingStopped = false
  let searchComplete = false
  let installed = false
  let partyBursting = false

  const typeTerm = async term => {
    while (!typingStopped && searchInput.value.length > 0) {
      searchInput.value = searchInput.value.slice(0, -1)
      await wait(34)
    }
    for (const character of term) {
      if (typingStopped) return
      searchInput.value += character
      await wait(54)
    }
  }

  const cycleSearchTerms = async () => {
    if (prefersReducedMotion) {
      searchInput.value = searchTerms.at(-1)
      return
    }

    let index = 1
    while (!typingStopped) {
      await wait(720)
      if (typingStopped) return
      await typeTerm(searchTerms[index])
      index = (index + 1) % searchTerms.length
    }
  }

  const showResults = () => {
    if (searchComplete) return
    searchComplete = true
    typingStopped = true
    if (!searchInput.value.trim()) searchInput.value = searchTerms.at(-1)
    searchButton.classList.remove('is-inviting')
    searchForm.classList.add('is-locked')
    emptyState.hidden = true
    results.hidden = false
    window.requestAnimationFrame(() => {
      results.classList.add('is-visible')
      installButton.classList.add('is-inviting')
    })
  }

  const closePermission = () => {
    overlay.classList.remove('is-open')
    const finish = () => {
      if (!overlay.classList.contains('is-open')) overlay.hidden = true
    }
    window.setTimeout(finish, prefersReducedMotion ? 0 : 180)
    if (!installed) installButton.classList.add('is-inviting')
  }

  const openPermission = () => {
    if (!overlay.hidden) return
    installButton.classList.remove('is-inviting')
    overlay.hidden = false
    window.requestAnimationFrame(() => {
      overlay.classList.add('is-open')
      allowButton.focus({ preventScroll: true })
    })
  }

  const activatePartyPopper = async () => {
    if (installed) return
    installed = true
    allowButton.disabled = true
    allowButton.querySelector('span').textContent = copy.previewing
    allowButton.classList.add('is-installing')
    await wait(620)
    overlay.classList.remove('is-open')
    overlay.hidden = true
    searchView.hidden = true
    chatView.hidden = false
    marketplace.classList.add('is-chat-active')
    marketplaceTitle.textContent = copy.liveWorkspace
    marketplaceMode.textContent = copy.partyMode
    hydrateReicons(chatView)
    window.requestAnimationFrame(() => chatView.classList.add('is-visible'))
    partyButton.focus({ preventScroll: true })
  }

  const burstConfetti = () => {
    if (prefersReducedMotion) return
    confettiLayer.replaceChildren()
    const colors = ['#f4f5f6', '#8e949f', '#25f4ee', '#fe2c55']
    const count = 24

    for (let index = 0; index < count; index += 1) {
      const piece = document.createElement('i')
      const angle = (Math.PI * 2 * index) / count
      const distance = 88 + Math.random() * 116
      const x = Math.cos(angle) * distance
      const y = Math.sin(angle) * distance - 68
      piece.className = index % 4 === 0 ? 'confetti-piece is-round' : 'confetti-piece'
      piece.style.setProperty('--confetti-x', `${x.toFixed(1)}px`)
      piece.style.setProperty('--confetti-y', `${y.toFixed(1)}px`)
      piece.style.setProperty('--confetti-r', `${Math.round(Math.random() * 480 - 240)}deg`)
      piece.style.setProperty('--confetti-delay', `${Math.round(Math.random() * 90)}ms`)
      piece.style.setProperty('--confetti-color', colors[index % colors.length])
      confettiLayer.append(piece)
    }

    window.setTimeout(() => confettiLayer.replaceChildren(), 1100)
  }

  const sendWithPartyPopper = () => {
    if (partyBursting) return
    partyBursting = true
    partyButton.classList.remove('is-inviting')
    partyHint.hidden = true
    partyMessage.hidden = false
    window.requestAnimationFrame(() => partyMessage.classList.add('is-visible'))
    burstConfetti()
    window.setTimeout(() => {
      partyBursting = false
      partyButton.classList.add('is-inviting')
    }, prefersReducedMotion ? 0 : 1400)
  }

  searchForm.addEventListener('submit', event => {
    event.preventDefault()
    showResults()
  })
  searchButton.addEventListener('pointerdown', event => {
    event.preventDefault()
    showResults()
  })

  installButton.addEventListener('click', openPermission)
  installButton.addEventListener('pointerdown', event => {
    event.preventDefault()
    openPermission()
  })
  cancelButtons.forEach(button => button.addEventListener('click', closePermission))
  overlay.addEventListener('click', event => {
    if (event.target === overlay) closePermission()
  })
  allowButton.addEventListener('click', activatePartyPopper)

  partyComposer.addEventListener('submit', event => {
    event.preventDefault()
    sendWithPartyPopper()
  })
  partyButton.addEventListener('pointerdown', event => {
    event.preventDefault()
    sendWithPartyPopper()
  })

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !overlay.hidden) closePermission()
  })

  cycleSearchTerms()
}
