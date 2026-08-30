import { Microphone } from './reicons.js?v=33'

const liveComposer = document.querySelector('[data-live-composer]')

if (liveComposer instanceof HTMLFormElement) {
  const output = document.querySelector('[data-conversation-output]')
  const voiceSlot = document.querySelector('[data-voice-slot]')
  const requestCopy = liveComposer.querySelector('[data-request-copy]')
  const sendButton = liveComposer.querySelector('.demo-send')
  const status = liveComposer.querySelector('[data-conversation-status]')
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let running = false

  const logs = [
    ['request', 'received', 'composer customization request'],
    ['inspect', 'surface', 'locating active composer contribution points'],
    ['scan', 'slot', 'header.actions'],
    ['scan', 'slot', 'composer.before'],
    ['scan', 'slot', 'composer.actions.before'],
    ['match', 'found', 'composer.actions.before'],
    ['resolve', 'package', '@cordisx/plugin-voice-input'],
    ['load', 'manifest', 'cordisx.plugin.json'],
    ['check', 'permission', 'microphone · request on use'],
    ['create', 'component', '<VoiceInputButton />'],
    ['code', '+ prop', 'placement="before:send"'],
    ['code', '+ state', 'idle → listening → transcribing'],
    ['code', '+ event', 'pointerdown / pointerup'],
    ['code', '+ event', 'keyboard activate'],
    ['wire', 'service', 'ctx.voiceInput'],
    ['wire', 'profile', 'default · local workspace'],
    ['style', 'token', '--control-size: 38px'],
    ['style', 'token', '--control-gap: 8px'],
    ['render', 'preview', 'mounting contribution'],
    ['verify', 'layout', 'no overflow at composer width'],
    ['verify', 'a11y', 'label · focus · reduced motion'],
    ['commit', 'surface', 'composer.actions.before'],
    ['success', 'mounted', 'voice input is ready'],
  ]

  const wait = milliseconds => new Promise(resolve => window.setTimeout(resolve, prefersReducedMotion ? 0 : milliseconds))
  const timestamp = index => {
    const seconds = String((index * 3) % 60).padStart(2, '0')
    const millis = String((index * 37) % 1000).padStart(3, '0')
    return `00:${seconds}.${millis}`
  }

  const addLog = (entry, index, stream) => {
    const line = document.createElement('div')
    const [kind, action, message] = entry
    line.className = `build-line${kind === 'code' ? ' is-code' : ''}${kind === 'success' ? ' is-success is-accent' : ''}${kind === 'commit' ? ' is-accent' : ''}`
    const time = document.createElement('time')
    const label = document.createElement('b')
    const text = document.createElement('span')
    time.textContent = timestamp(index)
    label.textContent = action
    text.textContent = message
    line.append(time, label, text)
    stream.append(line)
    output.scrollTop = output.scrollHeight
  }

  const installVoiceButton = () => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'voice-button'
    button.setAttribute('aria-label', 'Voice input')
    const icon = Microphone({
      size: 20,
      className: 'microphone-icon',
      attrs: { 'aria-hidden': 'true', focusable: 'false' },
    })
    button.append(icon)
    button.addEventListener('click', () => {
      const listening = button.classList.toggle('is-listening')
      button.setAttribute('aria-label', listening ? 'Stop voice input' : 'Voice input')
      if (status) status.textContent = listening ? 'Voice input started.' : 'Voice input stopped.'
    })
    voiceSlot.replaceChildren(button)
    voiceSlot.classList.add('is-ready')
  }

  const completeBuild = () => {
    const card = document.createElement('div')
    card.className = 'build-complete'
    const copy = document.createElement('div')
    const title = document.createElement('strong')
    const detail = document.createElement('small')
    const state = document.createElement('span')
    title.textContent = 'Voice input added'
    detail.textContent = 'composer.actions.before · active now'
    state.textContent = 'DONE'
    copy.append(title, detail)
    card.append(copy, state)
    output.append(card)
    output.scrollTop = output.scrollHeight
    installVoiceButton()
    liveComposer.classList.remove('is-building')
    sendButton.disabled = false
    sendButton.classList.add('is-inviting')
    sendButton.setAttribute('aria-label', 'Run the demo again')
    running = false
    if (status) status.textContent = 'The voice input button was added to the left of send.'
  }

  const runBuild = async () => {
    if (running || !(output instanceof HTMLElement)) return
    running = true
    liveComposer.classList.add('is-building')
    sendButton.classList.remove('is-inviting')
    sendButton.disabled = true
    sendButton.setAttribute('aria-label', 'Generating')
    voiceSlot.classList.remove('is-ready')
    voiceSlot.replaceChildren()
    output.replaceChildren()

    const request = document.createElement('div')
    request.className = 'request-message'
    request.textContent = requestCopy?.textContent.trim() || 'Add a voice input button to the left of my send button.'
    output.append(request)
    const stream = document.createElement('div')
    stream.className = 'build-stream'
    output.append(stream)

    for (let index = 0; index < logs.length; index += 1) {
      addLog(logs[index], index, stream)
      await wait(index < 5 ? 58 : 42)
    }
    await wait(180)
    completeBuild()
  }

  liveComposer.addEventListener('submit', event => {
    event.preventDefault()
    runBuild()
  })
}
