#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process'
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { showcaseMotionScene } from './showcase-motion-scene.mjs'

const projectRoot = path.resolve(import.meta.dirname, '..')
const defaultCordisXRoot = path.resolve(projectRoot, '..', 'cordisx')

function option(name, fallback) {
  const index = process.argv.indexOf(name)
  return index < 0 ? fallback : process.argv[index + 1]
}

const cordisxRoot = path.resolve(option('--cordisx-root', defaultCordisXRoot))
const appBundle = path.resolve(option('--app', '/Applications/ChatGPT.app'))
const authFile = path.resolve(option('--auth', path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex'), 'auth.json')))
const avatarFile = path.resolve(option('--avatar', path.join(projectRoot, 'assets', 'capture', 'cordisx-profile-avatar.png')))
const outputFile = path.resolve(option('--output', path.join(projectRoot, 'assets', 'screenshots', 'codex-workspace-real.png')))
const outputDir = path.resolve(option('--output-dir', path.join(projectRoot, 'assets', 'screenshots')))
const profileName = option('--name', 'CordisX')
const locale = option('--locale', 'en-US')
const motionEnabled = process.argv.includes('--motion')
const motionOutputDir = path.resolve(option('--motion-output-dir', path.join(projectRoot, 'assets', 'motion')))
const motionFrameRate = 12
const motionCursorSvg = await readFile(path.join(projectRoot, 'assets', 'capture', 'cordisx-motion-cursor.svg'), 'utf8')

if (process.argv.includes('--help')) {
  console.log('Usage: npm run capture:codex-showcase -- [--motion] [--motion-output-dir /absolute/motion] [--name CordisX] [--avatar /absolute/avatar.png] [--auth /absolute/auth.json] [--output /absolute/workspace.png] [--output-dir /absolute/screenshots] [--locale en-US] [--app /Applications/ChatGPT.app]')
  process.exit(0)
}

async function availablePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : null
  await new Promise(resolve => server.close(resolve))
  if (port === null) throw new Error('Could not reserve a loopback port')
  return port
}

function exited(child) {
  return child.exitCode !== null || child.signalCode !== null
}

async function waitForExit(child, timeout) {
  if (exited(child)) return true
  return await new Promise(resolve => {
    const timer = setTimeout(() => { child.off('exit', onExit); resolve(false) }, timeout)
    const onExit = () => { clearTimeout(timer); resolve(true) }
    child.once('exit', onExit)
  })
}

async function stop(child) {
  if (exited(child)) return
  for (const [signal, timeout] of [['SIGINT', 5_000], ['SIGTERM', 5_000], ['SIGKILL', 2_000]]) {
    try { process.kill(-child.pid, signal) } catch (error) { if (error?.code !== 'ESRCH') throw error }
    if (await waitForExit(child, timeout)) return
  }
}

function profileProcessIds(profilePath) {
  return execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' })
    .split('\n')
    .flatMap(line => {
      const match = /^\s*(\d+)\s+(.*)$/.exec(line)
      if (match === null || !match[2].includes(profilePath)) return []
      return [Number(match[1])]
    })
    .filter(pid => Number.isInteger(pid) && pid > 0 && pid !== process.pid)
}

async function stopProfileProcesses(profilePath) {
  for (const [signal, attempts] of [['SIGTERM', 30], ['SIGKILL', 20]]) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const pids = profileProcessIds(profilePath)
      if (pids.length === 0) return
      for (const pid of pids) {
        try { process.kill(pid, signal) } catch (error) { if (error?.code !== 'ESRCH') throw error }
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  const remaining = profileProcessIds(profilePath)
  if (remaining.length > 0) throw new Error(`Could not stop isolated Codex profile processes: ${remaining.join(', ')}`)
}

async function copyIfPresent(source, destination) {
  try {
    await copyFile(source, destination)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

async function waitForTarget(port, child) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (exited(child)) throw new Error(`CordisX launcher exited before Codex became ready (${String(child.exitCode)})`)
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(600) })
      if (response.ok) {
        const target = (await response.json()).find(item => item.type === 'page' && item.url === 'app://-/index.html')
        if (target?.webSocketDebuggerUrl) return target
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('Codex CDP target did not become ready')
}

function connect(url) {
  const socket = new WebSocket(url)
  let sequence = 0
  const pending = new Map()
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data))
    if (message.id === undefined) return
    const request = pending.get(message.id)
    if (request === undefined) return
    pending.delete(message.id)
    if (message.error) request.reject(new Error(message.error.message))
    else request.resolve(message.result)
  })
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  const send = async (method, params = {}) => {
    await ready
    const id = ++sequence
    return await new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })
  }
  return { socket, send }
}

async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
  return result.result?.value
}

async function capture(send, file) {
  const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, Buffer.from(screenshot.data, 'base64'))
}

async function setCaptureTheme(send, theme) {
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: theme }],
  })
  await evaluate(send, `(() => {
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
  })()`)
  await new Promise(resolve => setTimeout(resolve, 500))
}

async function waitForSelector(send, selector, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const visible = await evaluate(send, `(() => {
      const target = document.querySelector(${JSON.stringify(selector)})
      if (!(target instanceof HTMLElement)) return false
      const rect = target.getBoundingClientRect()
      const style = getComputedStyle(target)
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    })()`)
    if (visible) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Motion target did not become visible: ${selector}`)
}

async function recordMotion(send, framesDir) {
  await rm(framesDir, { recursive: true, force: true })
  await mkdir(framesDir, { recursive: true })
  await evaluate(send, `(() => {
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
  })()`)

  let frame = 0
  let point = { x: 1490, y: 860 }
  const writeFrame = async () => {
    await capture(send, path.join(framesDir, `frame-${String(frame).padStart(4, '0')}.png`))
    frame += 1
  }
  const setCursor = async (next, pressed = false, ring = false) => {
    await evaluate(send, `(() => {
      const cursor = document.querySelector('[data-cordisx-motion-cursor]')
      if (!(cursor instanceof HTMLElement)) return
      cursor.style.transform = 'translate(' + ${JSON.stringify(next.x)} + 'px,' + ${JSON.stringify(next.y)} + 'px) scale(' + ${pressed ? '0.82' : '1'} + ')'
      const ring = cursor.querySelector('span')
      if (ring instanceof HTMLElement) {
        ring.style.opacity = ${ring ? "'1'" : "'0'"}
        ring.style.transform = ${ring ? "'scale(1.28) rotate(12deg)'" : "'scale(.38) rotate(-18deg)'"}
      }
    })()`)
  }
  const targetPoint = async selector => await evaluate(send, `(() => {
    const target = document.querySelector(${JSON.stringify(selector)})
    if (!(target instanceof HTMLElement)) return null
    const rect = target.getBoundingClientRect()
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
  })()`)
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
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(motionFrameRate), '-i', pattern, '-vf', 'scale=1280:-2:flags=lanczos', '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { stdio: 'inherit' })
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(motionFrameRate), '-i', pattern, '-vf', 'scale=1280:-2:flags=lanczos,format=yuv420p', '-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-pix_fmt', 'yuv420p', webm], { stdio: 'inherit' })
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(motionFrameRate), '-i', pattern, '-filter_complex', '[0:v]fps=12,scale=960:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle', '-loop', '0', gif], { stdio: 'inherit' })
  return { mp4, webm, gif }
}

const avatar = `data:image/png;base64,${(await readFile(avatarFile)).toString('base64')}`
const port = await availablePort()
const captureRoot = await mkdtemp(path.join(os.tmpdir(), 'cordisx-showcase-capture-'))
const homeRoot = path.join(captureRoot, 'home')
const hostHome = path.join(homeRoot, '.cordisx', 'apps', 'codex', 'profiles', 'showcase', 'host-home')
const profileDir = path.join(captureRoot, 'chromium')
const workspaceDir = path.join(captureRoot, 'workspace')
const cordisxHome = path.join(homeRoot, '.cordisx')
const codexHome = path.join(cordisxHome, 'apps', 'codex', 'profiles', 'showcase', 'codex-home')
const configFile = path.join(cordisxHome, 'config.json')
const appLauncher = path.join(captureRoot, 'launch-codex-app')
const computerUseApp = path.join(codexHome, 'computer-use', 'Codex Computer Use.app')
const computerUseExecutable = path.join(computerUseApp, 'Contents', 'MacOS', 'SkyComputerUseService')
const pluginEntry = path.join(cordisxRoot, 'examples', 'plugins', 'slot-showcase', 'index.ts')
const cliEntry = path.join(cordisxRoot, 'packages', 'cli', 'dist', 'src', 'cli.js')

await mkdir(codexHome, { recursive: true, mode: 0o700 })
await mkdir(path.join(hostHome, '.cache'), { recursive: true, mode: 0o700 })
await mkdir(profileDir, { recursive: true, mode: 0o700 })
await mkdir(workspaceDir, { recursive: true, mode: 0o700 })
await mkdir(path.dirname(computerUseExecutable), { recursive: true, mode: 0o700 })
await writeFile(computerUseExecutable, '#!/bin/sh\nexec /bin/sleep 3600\n', { mode: 0o700 })
await chmod(computerUseExecutable, 0o700)
await writeFile(appLauncher, `#!/bin/sh
exec /usr/bin/open -n -F -W \\
  --env "HOME=$HOME" \\
  --env "CODEX_HOME=$CODEX_HOME" \\
  --env "LANG=$LANG" \\
  --env "LC_ALL=$LC_ALL" \\
  --env "LANGUAGE=$LANGUAGE" \\
  --env "CODEX_ELECTRON_SKIP_COMPUTER_USE_CANONICAL_REFRESH=1" \\
  --env "CODEX_ELECTRON_COMPUTER_USE_APP_PATH=$CODEX_ELECTRON_COMPUTER_USE_APP_PATH" \\
  ${JSON.stringify(appBundle)} --args "$@"
`, { mode: 0o700 })
await chmod(appLauncher, 0o700)
const sourceRuntimeCache = path.join(os.homedir(), '.cache', 'codex-runtimes')
execFileSync('/bin/cp', ['-cR', sourceRuntimeCache, path.join(hostHome, '.cache')], { stdio: 'inherit' })
console.log(`[showcase] cloned installed Codex runtime into isolated HOME: ${sourceRuntimeCache}`)
await copyFile(authFile, path.join(codexHome, 'auth.json'))
const sourceCodexHome = path.dirname(authFile)
for (const preferenceFile of [
  '.personality_migration',
  '.sandbox_migration',
  '.app-server-state-reconciled-v1',
]) {
  await copyIfPresent(path.join(sourceCodexHome, preferenceFile), path.join(codexHome, preferenceFile))
}
await writeFile(path.join(codexHome, '.codex-global-state.json'), `${JSON.stringify({
  'computer-use-bundled-plugin-auto-install-disabled': true,
  'electron-persisted-atom-state': {
    'electron:onboarding-primary-runtime-install-ready': true,
    'electron:onboarding-primary-runtime-install-requested': true,
    'electron:onboarding-welcome-pending': false,
    'electron:onboarding-hide-first-new-thread-promos': true,
    'chatgpt-migration-announcement-completed-v1': true,
    'flat-project-sidebar-preferences-v1': {
      chatSortMode: 'priority',
      initialized: true,
      mode: 'project',
      projectSortMode: 'priority',
    },
  },
  'electron-saved-workspace-roots': [],
  'active-workspace-roots': [],
  'local-projects': {},
  'pinned-project-ids': [],
  'pinned-thread-ids': [],
  'project-order': [],
  'projectless-thread-ids': [],
  'selected-project': null,
  'thread-project-assignments': {},
  'thread-workspace-root-hints': {},
  'thread-writable-roots': {},
}, null, 2)}\n`, { mode: 0o600 })
await writeFile(path.join(codexHome, 'config.toml'), `appearanceTheme = "system"
appearanceDarkChromeTheme = { accent = "#339cff", contrast = 60, fonts = { code = "", ui = "" }, ink = "#ffffff", opaqueWindows = true, semanticColors = { diffAdded = "#40c977", diffRemoved = "#fa423e", skill = "#ad7bf9" }, surface = "#181818" }
appearanceLightChromeTheme = { accent = "#339cff", contrast = 45, fonts = { code = "", ui = "" }, ink = "#1a1c1f", opaqueWindows = true, semanticColors = { diffAdded = "#00a240", diffRemoved = "#ba2623", skill = "#924ff7" }, surface = "#ffffff" }
`, { mode: 0o600 })
console.log('[showcase] opaque Codex chrome configured for isolated capture profile')
await writeFile(configFile, `${JSON.stringify({
  version: 1,
  defaultApp: 'codex',
  providers: [],
  plugins: [{ id: 'slot-showcase', entry: pluginEntry, enabled: true, config: {} }],
  permissions: [],
  publisherGrantIssuers: [],
  apps: { codex: { defaultProfile: 'showcase', profiles: { showcase: { displayName: 'Showcase capture', dataMode: 'host-isolated' } } } },
}, null, 2)}\n`, { mode: 0o600 })

const launcher = spawn(process.execPath, [
  cliEntry,
  'codex', 'showcase', '--data', 'host-isolated',
  '--executable', appLauncher,
  '--debug-port', String(port), '--profile-dir', profileDir,
  '--', '--start-minimized', `--lang=${locale}`,
], {
  cwd: workspaceDir,
  env: {
    ...process.env,
    HOME: homeRoot,
    LANG: `${locale.replace('-', '_')}.UTF-8`,
    LC_ALL: `${locale.replace('-', '_')}.UTF-8`,
    LANGUAGE: locale,
    CODEX_ELECTRON_SKIP_COMPUTER_USE_CANONICAL_REFRESH: '1',
    CODEX_ELECTRON_COMPUTER_USE_APP_PATH: computerUseApp,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: process.platform !== 'win32',
})
launcher.stdout.on('data', chunk => process.stdout.write(chunk))
launcher.stderr.on('data', chunk => process.stderr.write(chunk))

let cleanupPromise
const cleanup = () => cleanupPromise ??= (async () => {
  await stop(launcher)
  await stopProfileProcesses(profileDir)
  await rm(captureRoot, { recursive: true, force: true, maxRetries: 12, retryDelay: 200 })
})()
const interrupted = signal => {
  process.stderr.write(`\nCapture interrupted by ${signal}; cleaning the isolated Codex instance...\n`)
  void cleanup().finally(() => process.exit(130))
}
const onSigint = () => interrupted('SIGINT')
const onSigterm = () => interrupted('SIGTERM')
process.once('SIGINT', onSigint)
process.once('SIGTERM', onSigterm)

try {
  const target = await waitForTarget(port, launcher)
  const { socket, send } = connect(target.webSocketDebuggerUrl)
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setLocaleOverride', { locale })

  for (let attempt = 0; attempt < 180; attempt += 1) {
    const ready = await evaluate(send, `document.documentElement.dataset.cordisxReady === 'true' && globalThis.__cordisxRuntime !== undefined`)
    if (ready) break
    await new Promise(resolve => setTimeout(resolve, 250))
    if (attempt === 179) throw new Error('CordisX renderer did not become ready')
  }

  const onboarding = await evaluate(send, `(async () => {
    const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
    const labels = new Set([
      'Continue', 'Skip', 'Go to ChatGPT', 'Continue coding with Codex', 'Continue with Codex',
      '继续', '跳过', '前往 ChatGPT', '继续使用 Codex 编码',
    ])
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
  })()`)

  for (let attempt = 0; attempt < 180; attempt += 1) {
    const ready = await evaluate(send, `(() => {
      const text = (document.body?.innerText ?? '').trim()
      const composer = document.querySelector('textarea, [contenteditable="true"]')
      return text !== 'Thinking' && composer !== null && document.querySelectorAll('button').length > 8
    })()`)
    if (ready) break
    await new Promise(resolve => setTimeout(resolve, 500))
    if (attempt === 179) throw new Error('Codex workspace did not become interactive')
  }
  await new Promise(resolve => setTimeout(resolve, 4_000))

  const projection = await evaluate(send, `(() => {
    const translations = new Map(${JSON.stringify([
      ['新对话', 'New conversation'], ['快速聊天', 'Quick chat'], ['拉取请求', 'Pull requests'], ['站点', 'Sites'],
      ['已安排', 'Scheduled'], ['插件', 'Plugins'], ['项目', 'Projects'], ['没有项目', 'No projects'],
      ['最近', 'Recent'], ['无聊天', 'No chats'], ['暂无聊天', 'No chats'], ['我们要构建什么？', 'What should we build?'],
      ['探索并理解代码', 'Explore and understand code'], ['构建新功能、应用或工具', 'Build a feature, app, or tool'],
      ['审查代码并提出修改建议', 'Review code and suggest changes'], ['修复问题和失败', 'Fix issues and failures'],
      ['选择项目', 'Select a project'], ['随心输入', 'Ask anything'], ['请求批准', 'Ask for approval'],
      ['语音', 'Voice'], ['开始使用', 'Get started'], ['轻度', 'Low'], ['极高', 'X-high'],
      ['新建本地工作树', 'New local worktree'], ['无环境', 'No environment'], ['完全访问', 'Full access'],
      ['试试 ChatGPT 语音', 'Try ChatGPT Voice'], ['编排任务，连接工具，探索代码', 'Plan tasks, connect tools, and explore code'],
      ['开始语音', 'Start voice'],
    ])})
    const translate = value => {
      const direct = translations.get(value)
      if (direct !== undefined) return direct
      const workspacePrompt = /^你想让我们在 (.+) 中构建什么？$/u.exec(value)
      if (workspacePrompt !== null) return 'What should we build in ' + workspacePrompt[1] + '?'
      return value.replaceAll('极高', 'X-high')
    }
    let translated = 0
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const current = node.nodeValue ?? ''
      const trimmed = current.trim()
      const replacement = translate(trimmed)
      if (replacement === trimmed) continue
      node.nodeValue = current.replace(trimmed, replacement)
      translated += 1
    }
    for (const element of document.querySelectorAll('[placeholder], [aria-label], [title]')) {
      for (const attribute of ['placeholder', 'aria-label', 'title']) {
        const current = element.getAttribute(attribute)
        if (current === null) continue
        const replacement = translate(current.trim())
        if (replacement === current.trim()) continue
        element.setAttribute(attribute, current.replace(current.trim(), replacement))
        translated += 1
      }
    }

    const profile = [...document.querySelectorAll('button')].find(button => {
      const label = button.getAttribute('aria-label') ?? ''
      return /profile|个人资料/i.test(label)
    })
    if (profile instanceof HTMLElement) {
      profile.replaceChildren()
      const image = document.createElement('img')
      image.src = ${JSON.stringify(avatar)}
      image.alt = ''
      image.style.cssText = 'width:24px;height:24px;border-radius:7px;object-fit:cover;flex:0 0 auto'
      const label = document.createElement('span')
      label.textContent = ${JSON.stringify(profileName)}
      label.style.cssText = 'font:500 13px/1.2 system-ui,sans-serif;white-space:nowrap'
      profile.append(image, label)
      profile.setAttribute('aria-label', ${JSON.stringify(`${profileName} profile`)})
      profile.style.cssText += ';display:flex!important;align-items:center!important;gap:8px!important;width:auto!important;min-width:112px!important;padding:5px 9px!important'
    }

    const trigger = document.querySelector('[data-cordisx-manager-trigger]')
    if (trigger instanceof HTMLElement) trigger.setAttribute('aria-label', 'Open CordisX Manager')

    document.querySelectorAll('button').forEach(button => {
      const label = button.getAttribute('aria-label') ?? ''
      if (label.includes('个人资料')) button.setAttribute('aria-label', label.replace('打开个人资料菜单', 'Open profile menu'))
    })
    window.scrollTo(0, 0)
    const visibleText = document.body.innerText
    return {
      translated,
      profile: profile instanceof HTMLElement,
      cordisxEntry: trigger instanceof HTMLElement,
      onboardingVisible: /个性化|personalization/i.test(visibleText),
      remainingCjk: [...new Set(visibleText.split('\\n').map(line => line.trim()).filter(line => /[\u3400-\u9fff]/u.test(line)))].slice(0, 12),
    }
  })()`)

  if (!projection.profile) throw new Error('Could not project the CordisX profile identity')
  if (!projection.cordisxEntry) throw new Error('Could not expose the CordisX extension entry')
  if (projection.remainingCjk.length > 0) throw new Error(`Codex workspace still contains untranslated text: ${projection.remainingCjk.join(' | ')}`)
  await new Promise(resolve => setTimeout(resolve, 800))

  const finalLocalization = await evaluate(send, `(() => {
    const cjk = /[\u3400-\u9fff]/u
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const current = node.nodeValue ?? ''
      if (current.trim() === '随心输入') node.nodeValue = current.replace('随心输入', 'Ask anything')
    }
    for (const element of document.querySelectorAll('*')) {
      for (const attribute of [...element.attributes]) {
        if (!/placeholder/u.test(attribute.name) || !cjk.test(attribute.value)) continue
        element.setAttribute(attribute.name, 'Ask anything')
      }
    }
    const composer = document.querySelector('textarea, [contenteditable="true"]')
    if (composer instanceof HTMLElement) {
      let surface = composer.parentElement
      while (surface?.parentElement instanceof HTMLElement) {
        const rect = surface.getBoundingClientRect()
        if (rect.width > 500 && rect.height >= 80 && rect.height <= 240) break
        surface = surface.parentElement
      }
      if (surface instanceof HTMLElement) {
        surface.style.position = 'relative'
        const overlay = document.createElement('span')
        overlay.textContent = 'Ask anything'
        overlay.setAttribute('data-cordisx-capture-placeholder', 'true')
        overlay.style.cssText = 'position:absolute;z-index:20;left:0;top:18px;width:400px;box-sizing:border-box;padding:4px 72px 5px 20px;background:#2b2b2b;color:rgba(235,235,235,.46);font:400 16px/1.4 system-ui,sans-serif;pointer-events:none'
        surface.append(overlay)
      }
    }
    const voiceLabel = [...document.querySelectorAll('*')].find(element => (element.textContent ?? '').trim() === 'Try ChatGPT Voice')
    if (voiceLabel instanceof HTMLElement) {
      let banner = voiceLabel
      while (banner.parentElement instanceof HTMLElement) {
        const parent = banner.parentElement
        const rect = parent.getBoundingClientRect()
        if (rect.width > 500 && rect.height >= 60 && rect.height <= 160) { banner = parent; break }
        banner = parent
      }
      banner.remove()
    }
    const visibleCjk = [...new Set(document.body.innerText.split('\\n').map(line => line.trim()).filter(line => cjk.test(line)))].slice(0, 12)
    const placeholderCjk = [...document.querySelectorAll('[placeholder], [aria-placeholder], [data-placeholder]')]
      .filter(element => element instanceof HTMLElement && element.offsetParent !== null)
      .flatMap(element => ['placeholder', 'aria-placeholder', 'data-placeholder'].map(attribute => element.getAttribute(attribute) ?? ''))
      .filter(value => cjk.test(value))
    return { visibleCjk, placeholderCjk, placeholderOverlay: document.querySelector('[data-cordisx-capture-placeholder]') !== null }
  })()`)
  if (finalLocalization.visibleCjk.length > 0 || finalLocalization.placeholderCjk.length > 0) {
    throw new Error(`Codex workspace language drifted before capture: ${[...finalLocalization.visibleCjk, ...finalLocalization.placeholderCjk].join(' | ')}`)
  }

  const welcome = await evaluate(send, `(async () => {
    document.documentElement.lang = 'en'
    let navigationError = null
    let settled = false
    void globalThis.__cordisxRuntime.navigate('slot-showcase', { id: 'main.welcome' }).then(
      () => { settled = true },
      error => { navigationError = String(error); settled = true },
    )
    for (let attempt = 0; attempt < 160; attempt += 1) {
      const authorization = document.querySelector('[data-permission-authorization]')
      if (authorization !== null) {
        authorization.querySelectorAll('[data-permission-decision="allow-persistent"]').forEach(input => input.click())
        authorization.querySelector('[data-permission-action="confirm"], [data-authorization-decision="allow-persistent"]')?.click()
      }
      if (document.querySelector('[data-cordisx-welcome="true"]') !== null) return true
      if (settled && navigationError !== null) throw new Error(navigationError)
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return false
  })()`)
  if (!welcome) throw new Error('CordisX welcome page did not become visible')
  await new Promise(resolve => setTimeout(resolve, 700))
  await setCaptureTheme(send, 'dark')
  await capture(send, outputFile)
  const workspaceLightFile = path.join(outputDir, 'codex-workspace-real-light.png')
  await setCaptureTheme(send, 'light')
  await capture(send, workspaceLightFile)
  await setCaptureTheme(send, 'dark')

  const motionOutputs = {}
  if (motionEnabled) {
    for (const [language, documentLocale] of [['en', 'en'], ['zh', 'zh-CN']]) {
      for (const theme of ['dark', 'light']) {
        await evaluate(send, `(async () => {
          document.documentElement.lang = ${JSON.stringify(documentLocale)}
          document.querySelector('[data-cordisx-motion-cursor]')?.remove()
          const close = document.querySelector(
            '[data-cordisx-manager-modal] button[aria-label="关闭"], ' +
            '[data-cordisx-manager-modal] button[aria-label="Close"], ' +
            '[data-cordisx-manager-modal] button[aria-label="Close CordisX Manager"], ' +
            '[data-cordisx-manager-modal] .cxm-close'
          )
          if (close instanceof HTMLElement) {
            const plugins = document.querySelector('[data-tab="plugins"]')
            if (plugins instanceof HTMLElement) {
              plugins.click()
              await new Promise(resolve => setTimeout(resolve, 100))
            }
            close.click()
            for (let attempt = 0; attempt < 80; attempt += 1) {
              if (document.querySelector('[data-cordisx-manager-modal]') === null) break
              await new Promise(resolve => setTimeout(resolve, 50))
            }
          }
          await globalThis.__cordisxRuntime.navigate('slot-showcase', { id: 'main.welcome' })
        })()`)
        await setCaptureTheme(send, theme)
        await waitForSelector(send, '[data-cordisx-manager-trigger]')
        await new Promise(resolve => setTimeout(resolve, 500))
        const framesDir = path.join(captureRoot, `motion-frames-${language}-${theme}`)
        const frameCount = await recordMotion(send, framesDir)
        const basename = `cordisx-real-workflow-${language}-${theme}`
        motionOutputs[`${language}-${theme}`] = {
          frameCount,
          ...(await encodeMotion(framesDir, motionOutputDir, basename)),
        }
      }
    }
  }

  const managerOpened = await evaluate(send, `(async () => {
    if (document.querySelector('[data-tab="plugins"]') instanceof HTMLElement) return true
    const trigger = document.querySelector('[data-cordisx-manager-trigger]')
    if (!(trigger instanceof HTMLElement)) return false
    trigger.click()
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if ([...document.querySelectorAll('button, a, [role="button"]')].some(item => ['Plugins', '插件'].includes((item.textContent ?? '').trim()))) return true
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return false
  })()`)
  if (!managerOpened) throw new Error('CordisX Manager did not open')

  const managerPages = [
    'plugins',
    'extension-points',
    'routes',
    'marketplace',
  ]
  const captured = [outputFile, workspaceLightFile]
  for (const [language, documentLocale] of [['en', 'en'], ['zh', 'zh-CN']]) {
    await evaluate(send, `document.documentElement.lang = ${JSON.stringify(documentLocale)}`)
    await new Promise(resolve => setTimeout(resolve, 500))
    for (const theme of ['dark', 'light']) {
      await setCaptureTheme(send, theme)
      for (const pageId of managerPages) {
        const selected = await evaluate(send, `(async () => {
          const target = document.querySelector('[data-tab=${JSON.stringify(pageId)}]')
          if (!(target instanceof HTMLElement)) return false
          target.click()
          await new Promise(resolve => setTimeout(resolve, 450))
          return true
        })()`)
        if (!selected) throw new Error(`Could not select CordisX Manager page: ${pageId}`)
        const file = path.join(outputDir, `cordisx-manager-${pageId}-${language}-${theme}.png`)
        await capture(send, file)
        captured.push(file)
      }
    }
  }

  console.log(JSON.stringify({ outputs: captured, motionOutputs, locale, name: profileName, onboarding, projection, finalLocalization }, null, 2))
  socket.close()
} finally {
  process.off('SIGINT', onSigint)
  process.off('SIGTERM', onSigterm)
  await cleanup()
}

// Node's built-in WebSocket can retain an idle CDP handle after the renderer has
// already exited. The capture is complete and every isolated process is gone.
process.exit(0)
