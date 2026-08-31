import { hydrateReicons } from './reicons.js'

const showcase = document.querySelector('[data-showcase]')

if (showcase) {
  const slides = [...showcase.querySelectorAll('.showcase-slide')]
  const pages = [...showcase.querySelectorAll('[data-showcase-page]')]
  const indexLabel = showcase.querySelector('[data-showcase-index]')
  const title = showcase.querySelector('[data-showcase-title]:not(.showcase-slide)')
  const description = showcase.querySelector('[data-showcase-description]:not(.showcase-slide)')
  const previous = showcase.querySelector('[data-showcase-previous]')
  const next = showcase.querySelector('[data-showcase-next]')
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let activeIndex = 0
  let timer

  const show = (nextIndex, { restart = true } = {}) => {
    activeIndex = (nextIndex + slides.length) % slides.length

    slides.forEach((slide, index) => {
      const active = index === activeIndex
      slide.classList.toggle('is-active', active)
      slide.setAttribute('aria-hidden', String(!active))
    })

    pages.forEach((page, index) => {
      if (index === activeIndex) page.setAttribute('aria-current', 'true')
      else page.removeAttribute('aria-current')
    })

    const activeSlide = slides[activeIndex]
    indexLabel.textContent = String(activeIndex + 1).padStart(2, '0')
    title.textContent = activeSlide.dataset.showcaseTitle
    description.textContent = activeSlide.dataset.showcaseDescription

    if (restart) start()
  }

  const start = () => {
    window.clearInterval(timer)
    if (reduceMotion) return
    timer = window.setInterval(() => show(activeIndex + 1, { restart: false }), 5600)
  }

  previous.addEventListener('click', () => show(activeIndex - 1))
  next.addEventListener('click', () => show(activeIndex + 1))
  pages.forEach(page => page.addEventListener('click', () => show(Number(page.dataset.showcasePage))))

  showcase.addEventListener('mouseenter', () => window.clearInterval(timer))
  showcase.addEventListener('mouseleave', start)
  showcase.addEventListener('focusin', () => window.clearInterval(timer))
  showcase.addEventListener('focusout', event => {
    if (!showcase.contains(event.relatedTarget)) start()
  })

  hydrateReicons(showcase)
  start()
}
