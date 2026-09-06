import { execFileSync } from 'node:child_process'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { showcaseMotionScene } from './showcase-motion-scene.mjs'

// Screenshot normalization and deterministic scene recording/encoding.
export function createShowcaseCaptureMedia({ motionCursorSvg, motionFrameRate }) {
  async function evaluate(send, expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    }
    return result.result?.value
  }

  async function capture(send, file, opaque = false) {
    const screenshot = await send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    })
    await mkdir(path.dirname(file), { recursive: true })
    if (!opaque) {
      await writeFile(file, Buffer.from(screenshot.data, 'base64'))
      return
    }
    const source = path.join(path.dirname(file), `.${path.basename(file, '.png')}-rgba-${process.pid}.png`)
    const normalized = `${source}.opaque.png`
    try {
      await writeFile(source, Buffer.from(screenshot.data, 'base64'))
      execFileSync('ffmpeg', [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        source,
        '-vf',
        'format=rgb24',
        '-frames:v',
        '1',
        normalized,
      ], { stdio: 'inherit' })
      await rename(normalized, file)
    } finally {
      await Promise.all([rm(source, { force: true }), rm(normalized, { force: true })])
    }
  }

  async function setCaptureTheme(send, theme) {
    const background = theme === 'dark'
      ? { r: 24, g: 24, b: 24, a: 1 }
      : { r: 255, g: 255, b: 255, a: 1 }
    await send('Emulation.setDefaultBackgroundColorOverride', { color: background })
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: theme }],
    })
    await evaluate(
      send,
      `(() => {
    const theme = ${JSON.stringify(theme)}
    for (const element of [document.documentElement, document.body]) {
      if (!(element instanceof HTMLElement)) continue
      element.dataset.theme = theme
      element.dataset.colorTheme = theme
      element.dataset.colorScheme = theme
      element.style.colorScheme = theme
      element.classList.remove('dark', 'light', 'electron-dark', 'electron-light')
      element.classList.add(theme, 'electron-' + theme)
    }
  })()`,
    )
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  async function waitForSelector(send, selector, attempts = 100) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const visible = await evaluate(
        send,
        `(() => {
      const target = document.querySelector(${JSON.stringify(selector)})
      if (!(target instanceof HTMLElement)) return false
      const rect = target.getBoundingClientRect()
      const style = getComputedStyle(target)
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    })()`,
      )
      if (visible) return
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error(`Motion target did not become visible: ${selector}`)
  }

  async function recordMotion(send, framesDir) {
    await rm(framesDir, { recursive: true, force: true })
    await mkdir(framesDir, { recursive: true })
    await evaluate(
      send,
      `(() => {
    document.querySelector('[data-cordisx-motion-cursor]')?.remove()
    const cursor = document.createElement('div')
    cursor.dataset.cordisxMotionCursor = 'true'
    cursor.setAttribute('aria-hidden', 'true')
    cursor.innerHTML = ${JSON.stringify(motionCursorSvg)} + '<span><i></i></span>'
    cursor.style.cssText = 'position:fixed;left:-13px;top:-13px;width:64px;height:64px;z-index:2147483647;pointer-events:none;transform:translate(1490px,860px);transform-origin:13px 13px;filter:drop-shadow(0 5px 9px rgba(0,0,0,.38));will-change:transform'
    const ring = cursor.querySelector('span')
    ring.style.cssText = 'position:absolute;left:-1px;top:-1px;width:28px;height:28px;border:2px solid rgba(250,251,253,.95);border-radius:50%;box-shadow:-3px 0 0 #52e4df,3px 0 0 #ff5d7a;opacity:0;transform:scale(.38) rotate(-18deg);transform-origin:center'
    const innerRing = ring.querySelector('i')
    innerRing.style.cssText = 'position:absolute;inset:6px;border:1px solid rgba(250,251,253,.7);border-radius:50%'
    document.body.append(cursor)
  })()`,
    )

    let frame = 0
    let point = { x: 1490, y: 860 }
    const writeFrame = async () => {
      await capture(send, path.join(framesDir, `frame-${String(frame).padStart(4, '0')}.png`))
      frame += 1
    }
    const setCursor = async (next, pressed = false, ring = false) => {
      await evaluate(
        send,
        `(() => {
      const cursor = document.querySelector('[data-cordisx-motion-cursor]')
      if (!(cursor instanceof HTMLElement)) return
      cursor.style.transform = 'translate(' + ${JSON.stringify(next.x)} + 'px,' + ${
          JSON.stringify(next.y)
        } + 'px) scale(' + ${pressed ? '0.82' : '1'} + ')'
      const ring = cursor.querySelector('span')
      if (ring instanceof HTMLElement) {
        ring.style.opacity = ${ring ? "'1'" : "'0'"}
        ring.style.transform = ${ring ? "'scale(1.28) rotate(12deg)'" : "'scale(.38) rotate(-18deg)'"}
      }
    })()`,
      )
    }
    const targetPoint = async selector =>
      await evaluate(
        send,
        `(() => {
    const target = document.querySelector(${JSON.stringify(selector)})
    if (!(target instanceof HTMLElement)) return null
    const rect = target.getBoundingClientRect()
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
  })()`,
      )
    const hold = async frames => {
      for (let index = 0; index < frames; index += 1) await writeFrame()
    }
    const move = async (selector, frames) => {
      await waitForSelector(send, selector)
      const target = await targetPoint(selector)
      if (target === null) throw new Error(`Could not resolve motion target: ${selector}`)
      const from = point
      for (let index = 1; index <= frames; index += 1) {
        const progress = index / frames
        const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - ((-2 * progress + 2) ** 3) / 2
        point = {
          x: Math.round(from.x + (target.x - from.x) * eased),
          y: Math.round(from.y + (target.y - from.y) * eased),
        }
        await setCursor(point)
        await writeFrame()
      }
    }
    const click = async action => {
      await setCursor(point, true, true)
      await hold(2)
      await evaluate(send, `document.querySelector(${JSON.stringify(action.selector)})?.click()`)
      if (action.selector === '[data-cordisx-manager-trigger]') {
        await waitForSelector(send, '[data-tab="plugins"]')
        await evaluate(send, `document.querySelector('[data-tab="plugins"]')?.click()`)
      }
      await setCursor(point, false, true)
      await hold(2)
      await setCursor(point)
      if (action.waitFor) await waitForSelector(send, action.waitFor)
      await new Promise(resolve => setTimeout(resolve, 350))
      await hold(3)
    }

    await setCursor(point)
    for (const action of showcaseMotionScene) {
      if (action.type === 'hold') await hold(action.frames)
      else if (action.type === 'move') await move(action.selector, action.frames)
      else if (action.type === 'click') await click(action)
      else throw new Error(`Unknown motion action: ${action.type}`)
    }
    await evaluate(send, `document.querySelector('[data-cordisx-motion-cursor]')?.remove()`)
    return frame
  }

  async function encodeMotion(framesDir, outputDir, basename) {
    await mkdir(outputDir, { recursive: true })
    const pattern = path.join(framesDir, 'frame-%04d.png')
    const mp4 = path.join(outputDir, `${basename}.mp4`)
    const webm = path.join(outputDir, `${basename}.webm`)
    const gif = path.join(outputDir, `${basename}.gif`)
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      String(motionFrameRate),
      '-i',
      pattern,
      '-vf',
      'scale=1280:-2:flags=lanczos',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '21',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      mp4,
    ], { stdio: 'inherit' })
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      String(motionFrameRate),
      '-i',
      pattern,
      '-vf',
      'scale=1280:-2:flags=lanczos,format=yuv420p',
      '-c:v',
      'libvpx-vp9',
      '-crf',
      '32',
      '-b:v',
      '0',
      '-pix_fmt',
      'yuv420p',
      webm,
    ], { stdio: 'inherit' })
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      String(motionFrameRate),
      '-i',
      pattern,
      '-filter_complex',
      '[0:v]fps=12,scale=960:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle',
      '-loop',
      '0',
      gif,
    ], { stdio: 'inherit' })
    return { mp4, webm, gif }
  }

  return { evaluate, capture, setCaptureTheme, waitForSelector, recordMotion, encodeMotion }
}
