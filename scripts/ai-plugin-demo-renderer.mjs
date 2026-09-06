import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Renderer interaction and source-frame recording for one isolated demo run.
export function createAiPluginDemoRenderer(
  { scene, presentation, motionCursorSvg, framesDirectory, pluginEntry, maximumAgentSeconds },
) {
  async function evaluate(send, expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    }
    return result.result?.value
  }

  async function waitForRuntime(send) {
    for (let attempt = 0; attempt < 1_200; attempt += 1) {
      const ready = await evaluate(
        send,
        `document.documentElement.dataset.cordisxReady === 'true' && globalThis.__cordisxRuntime !== undefined`,
      )
      if (ready) return
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    throw new Error('CordisX renderer did not become ready')
  }

  async function finishOnboarding(send) {
    const clicked = await evaluate(
      send,
      `(async () => {
    const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
    const labels = new Set(['Continue', 'Skip', 'Go to ChatGPT', 'Continue coding with Codex', 'Continue with Codex', '继续', '跳过', '前往 ChatGPT', '继续使用 Codex 编码'])
    const finalLabels = new Set(['Go to ChatGPT', 'Continue coding with Codex', 'Continue with Codex', '前往 ChatGPT', '继续使用 Codex 编码'])
    const clicked = []
    for (let step = 0; step < 8; step += 1) {
      const candidates = [...document.querySelectorAll('button, a, [role="button"]')].filter(button => {
        const rect = button.getBoundingClientRect()
        const style = getComputedStyle(button)
        const text = (button.textContent ?? '').trim()
        return [...labels].some(label => text === label || text.includes(label)) && rect.width > 0 && rect.height > 0
          && style.visibility !== 'hidden' && style.display !== 'none'
      })
      const button = candidates.find(item => finalLabels.has((item.textContent ?? '').trim())) ?? candidates[0]
      if (!(button instanceof HTMLElement)) break
      const engineering = [...document.querySelectorAll('button, [role="radio"], label')]
        .find(item => ['Engineering', '工程'].includes((item.textContent ?? '').trim()))
      const choice = engineering ?? [...document.querySelectorAll('[role="radio"]')]
        .find(item => item.getAttribute('aria-checked') !== 'true')
      if (choice instanceof HTMLElement) { choice.click(); await wait(300) }
      clicked.push((button.textContent ?? '').trim())
      button.click()
      await wait(900)
    }
    return clicked
  })()`,
    )
    for (let attempt = 0; attempt < 360; attempt += 1) {
      const ready = await composerState(send)
      if (ready.composer !== null) return clicked
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    throw new Error('Codex workspace did not expose an interactive composer')
  }

  async function setCapturePresentation(send) {
    await send('Emulation.setDefaultBackgroundColorOverride', {
      color: scene.theme === 'dark' ? { r: 24, g: 24, b: 24, a: 1 } : { r: 255, g: 255, b: 255, a: 1 },
    })
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scene.theme }] })
    await send('Emulation.setLocaleOverride', { locale: scene.locale })
    await send('Emulation.setDeviceMetricsOverride', {
      width: scene.output.width,
      height: scene.output.height,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await evaluate(
      send,
      `(() => {
    document.documentElement.lang = ${JSON.stringify(scene.locale)}
    for (const element of [document.documentElement, document.body]) {
      if (!(element instanceof HTMLElement)) continue
      element.dataset.theme = ${JSON.stringify(scene.theme)}
      element.dataset.colorTheme = ${JSON.stringify(scene.theme)}
      element.dataset.colorScheme = ${JSON.stringify(scene.theme)}
      element.style.colorScheme = ${JSON.stringify(scene.theme)}
      element.classList.remove('light', 'electron-light', 'dark', 'electron-dark')
      element.classList.add(${JSON.stringify(scene.theme)}, ${JSON.stringify(`electron-${scene.theme}`)})
    }
    for (const button of document.querySelectorAll('button')) {
      const label = button.getAttribute('aria-label') ?? ''
      if (!/profile|个人资料|账户/i.test(label)) continue
      button.replaceChildren()
      const safe = document.createElement('span')
      safe.textContent = 'CordisX Demo'
      safe.style.cssText = 'font:500 13px/1.2 system-ui,sans-serif;white-space:nowrap'
      button.append(safe)
      button.setAttribute('aria-label', 'CordisX Demo profile')
    }
    window.scrollTo(0, 0)
  })()`,
    )
    await new Promise(resolve => setTimeout(resolve, 800))
  }

  async function installPointer(send) {
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
    const inner = ring.querySelector('i')
    inner.style.cssText = 'position:absolute;inset:6px;border:1px solid rgba(250,251,253,.7);border-radius:50%'
    document.body.append(cursor)
  })()`,
    )
  }

  async function setPointer(send, point, pressed = false, ringVisible = false) {
    await evaluate(
      send,
      `(() => {
    const cursor = document.querySelector('[data-cordisx-motion-cursor]')
    if (!(cursor instanceof HTMLElement)) return
    cursor.style.transform = 'translate(' + ${JSON.stringify(point.x)} + 'px,' + ${
        JSON.stringify(point.y)
      } + 'px) scale(' + ${pressed ? '0.82' : '1'} + ')'
    const ring = cursor.querySelector('span')
    if (ring instanceof HTMLElement) {
      ring.style.opacity = ${ringVisible ? "'1'" : "'0'"}
      ring.style.transform = ${ringVisible ? "'scale(1.28) rotate(12deg)'" : "'scale(.38) rotate(-18deg)'"}
    }
  })()`,
    )
  }

  async function composerState(send) {
    return await evaluate(
      send,
      `(() => {
    const visible = element => {
      if (!(element instanceof HTMLElement)) return false
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    }
    const composerCandidates = [...document.querySelectorAll(${JSON.stringify(scene.selectors.composer)})]
      .filter(element => visible(element) && (element.matches('textarea') || element.getAttribute('contenteditable') === 'true'))
      .sort((left, right) => right.getBoundingClientRect().top - left.getBoundingClientRect().top)
    const composer = composerCandidates[0]
    if (!(composer instanceof HTMLElement)) return { composer: null, submit: null, busy: false }
    const rect = composer.getBoundingClientRect()
    const text = composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement
      ? composer.value
      : composer.textContent ?? ''
    const buttons = [...document.querySelectorAll('button, [role="button"]')]
      .filter(button => visible(button))
      .map(button => {
        const buttonRect = button.getBoundingClientRect()
        const label = [button.getAttribute('aria-label'), button.getAttribute('title'), button.textContent]
          .filter(Boolean).join(' ').trim()
        const horizontal = Math.abs((buttonRect.left + buttonRect.width / 2) - rect.right)
        const vertical = Math.abs((buttonRect.top + buttonRect.height / 2) - (rect.top + rect.height / 2))
        const explicit = /(^|\\s)(send|submit|发送)(\\s|$)/iu.test(label) || button.getAttribute('type') === 'submit'
        return { button, buttonRect, label, disabled: button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true', score: horizontal + vertical * 2 - (explicit ? 1000 : 0), explicit }
      })
      .filter(item => item.explicit || (item.buttonRect.left >= rect.right - 160 && Math.abs(item.buttonRect.bottom - rect.bottom) < 100))
      .sort((left, right) => left.score - right.score)
    const submit = buttons[0]
    const busy = [...document.querySelectorAll('button, [role="button"]')].some(button => {
      if (!visible(button)) return false
      const label = [button.getAttribute('aria-label'), button.getAttribute('title'), button.textContent]
        .filter(Boolean).join(' ').trim()
      return /(stop|interrupt|cancel generation|停止|中断)/iu.test(label)
    })
    return {
      composer: { x: Math.round(rect.left + Math.min(rect.width / 2, 280)), y: Math.round(rect.top + Math.min(rect.height / 2, 36)), text },
      submit: submit === undefined ? null : {
        x: Math.round(submit.buttonRect.left + submit.buttonRect.width / 2),
        y: Math.round(submit.buttonRect.top + submit.buttonRect.height / 2),
        label: submit.label,
        disabled: submit.disabled,
      },
      busy,
    }
  })()`,
    )
  }

  async function pluginGeneration(send) {
    return await evaluate(
      send,
      `(() => {
    const plugin = globalThis.__cordisxRuntime?.snapshot?.().plugins?.find(item => item.id === 'send-confetti')
    if (plugin === undefined || plugin.status !== 'active') return null
    return plugin.package?.moduleGeneration ?? plugin.artifactGeneration ?? JSON.stringify({
      source: plugin.source,
      status: plugin.status,
      registrations: globalThis.__cordisxRuntime.snapshot().registrations.filter(item => item.owner === 'send-confetti').map(item => item.qualifiedId),
    })
  })()`,
    )
  }

  class FrameRecorder {
    constructor(send) {
      this.send = send
      this.frameCount = 0
      this.timeline = []
      this.startedAt = Date.now()
      this.segment = 'bootstrap'
    }

    async frame(segment = this.segment) {
      this.segment = segment
      const screenshot = await this.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 88,
        fromSurface: true,
        captureBeyondViewport: false,
      })
      const file = path.join(framesDirectory, `frame-${String(this.frameCount).padStart(6, '0')}.jpg`)
      await writeFile(file, Buffer.from(screenshot.data, 'base64'))
      this.timeline.push({ frame: this.frameCount, segment, sourceElapsedMs: Date.now() - this.startedAt })
      this.frameCount += 1
    }

    async hold(frames, segment) {
      const interval = 1_000 / scene.output.frameRate
      for (let index = 0; index < frames; index += 1) {
        const started = Date.now()
        await this.frame(segment)
        await new Promise(resolve => setTimeout(resolve, Math.max(0, interval - (Date.now() - started))))
      }
    }
  }

  async function clickPoint(send, recorder, point, segment) {
    await setPointer(send, point, false, false)
    await recorder.hold(2, `${segment}:approach`)
    await setPointer(send, point, true, true)
    await recorder.hold(2, `${segment}:pressed`)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y, button: 'none' })
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: point.x,
      y: point.y,
      button: 'left',
      clickCount: 1,
    })
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: point.x,
      y: point.y,
      button: 'left',
      clickCount: 1,
    })
    await setPointer(send, point, false, true)
    await recorder.hold(2, `${segment}:released`)
    await setPointer(send, point, false, false)
  }

  async function typeIntoComposer(send, recorder, text, segment, framesPerCharacter) {
    const state = await composerState(send)
    if (state.composer === null) throw new Error(`Composer is unavailable before ${segment}`)
    if (state.composer.text.trim() !== '') throw new Error(`Composer was not empty before ${segment}`)
    await clickPoint(send, recorder, state.composer, `${segment}:focus`)
    for (const character of [...text]) {
      await send('Input.insertText', { text: character })
      await recorder.hold(framesPerCharacter, segment)
    }
    const after = await composerState(send)
    if (after.composer?.text.trim() !== text) {
      throw new Error(`Composer text mismatch before ${segment}: ${JSON.stringify(after.composer?.text)}`)
    }
  }

  async function clickNativeSubmit(send, recorder, segment) {
    const state = await composerState(send)
    if (state.submit === null) throw new Error(`Native submit control is unavailable before ${segment}`)
    if (state.submit.disabled) throw new Error(`Native submit control is disabled before ${segment}`)
    await clickPoint(send, recorder, state.submit, segment)
  }

  async function visibleCenter(send, selector, label) {
    for (let attempt = 0; attempt < 160; attempt += 1) {
      const point = await evaluate(
        send,
        `(() => {
      const target = document.querySelector(${JSON.stringify(selector)})
      if (!(target instanceof HTMLElement)) return null
      const rect = target.getBoundingClientRect()
      const style = getComputedStyle(target)
      if (rect.width <= 0 || rect.height <= 0 || style.visibility === 'hidden' || style.display === 'none') return null
      return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
    })()`,
      )
      if (point !== null) return point
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error(`${label} did not become visible: ${selector}`)
  }

  async function openScaffoldedPluginDetails(send, recorder) {
    const triggerSelector = '[data-cordisx-manager-trigger]'
    const pluginSelector = '[data-plugin-id="send-confetti"]'
    const detailSelector = '[data-plugin-detail="send-confetti"]'
    await clickPoint(
      send,
      recorder,
      await visibleCenter(send, triggerSelector, 'CordisX settings trigger'),
      'settings-open',
    )
    await visibleCenter(send, '[data-tab="plugins"]', 'CordisX plugins settings page')
    await recorder.hold(14, 'settings-plugins')
    await clickPoint(
      send,
      recorder,
      await visibleCenter(send, pluginSelector, 'send-confetti plugin card'),
      'settings-plugin-open',
    )
    await visibleCenter(send, detailSelector, 'send-confetti plugin details')
    const projection = await evaluate(
      send,
      `(() => {
    const detail = document.querySelector(${JSON.stringify(detailSelector)})
    if (!(detail instanceof HTMLElement)) return null
    return {
      id: detail.dataset.pluginDetail,
      text: detail.innerText,
      localDevelopment: detail.innerText.includes(${JSON.stringify(presentation.localDevelopmentMarker)}),
      localizedReadme: detail.innerText.toLocaleLowerCase().includes(${
        JSON.stringify(presentation.readmeMarker.toLocaleLowerCase())
      }),
    }
  })()`,
    )
    if (
      projection?.id !== 'send-confetti' || !projection.text.includes('send-confetti')
      || !projection.localDevelopment || !projection.localizedReadme
    ) {
      throw new Error(`Scaffolded plugin details projection is invalid: ${JSON.stringify(projection)}`)
    }
    await recorder.hold(34, 'settings-plugin-detail')
    return {
      openedAt: new Date().toISOString(),
      pluginId: projection.id,
      localDevelopment: projection.localDevelopment,
      localizedReadme: projection.localizedReadme,
      readmeLocale: scene.locale,
      listSelector: pluginSelector,
      detailSelector,
    }
  }

  async function waitForInitialGeneration(send, recorder) {
    for (let attempt = 0; attempt < 600; attempt += 1) {
      const generation = await pluginGeneration(send)
      if (generation !== null) return generation
      await recorder.frame('baseline-generation')
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    throw new Error('Baseline scaffolded-plugin local-development generation did not become active')
  }

  async function waitForAgentAndReplacement(send, recorder, baselineGeneration, initialSource) {
    const deadline = Date.now() + maximumAgentSeconds * 1_000
    let replacementGeneration = null
    let stableSince = 0
    let sourceChanged = false
    while (Date.now() < deadline) {
      await recorder.frame('codex-builds-and-cordisx-loads')
      const [source, generation, state] = await Promise.all([
        readFile(pluginEntry, 'utf8').catch(error => {
          if (error?.code === 'ENOENT') return null
          throw error
        }),
        pluginGeneration(send),
        composerState(send),
      ])
      if (source === null) {
        await new Promise(resolve => setTimeout(resolve, 200))
        continue
      }
      sourceChanged ||= source !== initialSource
      if (generation !== null && generation !== baselineGeneration) {
        if (replacementGeneration !== generation) {
          replacementGeneration = generation
          stableSince = Date.now()
        }
      }
      if (
        sourceChanged && replacementGeneration !== null && !state.busy && state.composer !== null
        && state.submit !== null
      ) {
        if (Date.now() - stableSince >= 3_000) {
          return { replacementGeneration, sourceChanged, readyAt: new Date().toISOString() }
        }
      }
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    throw new Error(
      `Real Codex turn did not produce a stable replacement generation within ${maximumAgentSeconds} seconds`,
    )
  }

  async function waitForEffect(send, recorder) {
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      await recorder.frame('fullscreen-confetti:waiting')
      const visible = await evaluate(
        send,
        `(() => {
      const target = document.querySelector(${JSON.stringify(scene.selectors.effect)})
      if (!(target instanceof HTMLElement)) return false
      const rect = target.getBoundingClientRect()
      const style = getComputedStyle(target)
      return rect.width >= innerWidth * 0.95 && rect.height >= innerHeight * 0.95
        && style.visibility !== 'hidden' && style.display !== 'none'
    })()`,
      )
      if (visible) return { observedAt: new Date().toISOString(), selector: scene.selectors.effect }
      await new Promise(resolve => setTimeout(resolve, 80))
    }
    throw new Error(`Full-screen effect did not become visible: ${scene.selectors.effect}`)
  }

  async function waitForEffectCleanup(send, recorder) {
    const deadline = Date.now() + 8_000
    while (Date.now() < deadline) {
      const present = await evaluate(send, `document.querySelector(${JSON.stringify(scene.selectors.effect)}) !== null`)
      if (!present) {
        await recorder.hold(6, 'confetti-cleared')
        return { cleanupObserved: true, cleanedAt: new Date().toISOString() }
      }
      await recorder.frame('confetti-cleanup:waiting')
      await new Promise(resolve => setTimeout(resolve, 80))
    }
    throw new Error(`Full-screen effect was not cleaned up: ${scene.selectors.effect}`)
  }

  async function capturePoster(send, file) {
    const screenshot = await send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    })
    await writeFile(file, Buffer.from(screenshot.data, 'base64'))
  }

  return {
    evaluate,
    waitForRuntime,
    finishOnboarding,
    setCapturePresentation,
    installPointer,
    composerState,
    FrameRecorder,
    waitForInitialGeneration,
    typeIntoComposer,
    clickNativeSubmit,
    waitForAgentAndReplacement,
    waitForEffect,
    capturePoster,
    waitForEffectCleanup,
    openScaffoldedPluginDetails,
  }
}
