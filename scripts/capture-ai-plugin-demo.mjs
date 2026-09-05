#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  access,
  chmod,
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import {
  AI_PLUGIN_DEMO_HOST_COMMIT,
  AI_PLUGIN_DEMO_PRESENTATIONS,
  AI_PLUGIN_DEMO_PROTOCOL_COMMIT,
  aiPluginDemoScene,
} from './ai-plugin-demo-scene.mjs'
import { selectPlaybackTimeline } from './ai-plugin-demo-playback.mjs'

const projectRoot = path.resolve(import.meta.dirname, '..')
const fixtureRoot = path.join(import.meta.dirname, 'fixtures', 'ai-plugin-demo')
const defaultCordisXRoot = path.resolve(projectRoot, '..', 'cordisx')

function option(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index < 0) return fallback
  const value = process.argv[index + 1]
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} requires a value`)
  return value
}

const dryRun = process.argv.includes('--dry-run')
const launchSmoke = process.argv.includes('--launch-smoke')
const keepTemporaryFiles = process.argv.includes('--keep-temp')
const captureLanguage = option('--language', 'zh')
const captureTheme = option('--theme', aiPluginDemoScene.theme)
const cordisxRoot = path.resolve(option('--cordisx-root', defaultCordisXRoot))
const appBundle = path.resolve(option('--app', '/Applications/ChatGPT.app'))
const authFile = path.resolve(
  option('--auth', path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex'), 'auth.json')),
)
const outputDirectory = path.resolve(option('--output-dir', path.join(projectRoot, 'assets', 'motion')))
const posterDirectory = path.resolve(option('--poster-dir', path.join(projectRoot, 'assets', 'screenshots')))
const outputBasename = option('--output-basename', `cordisx-ai-plugin-demo-${captureLanguage}-${captureTheme}`)
const effectSelector = option('--effect-selector', aiPluginDemoScene.selectors.effect)
const maximumAgentSeconds = Number(option(
  '--max-agent-seconds',
  String(
    aiPluginDemoScene.timeline.find(item => item.type === 'wait-real-agent-and-generation')?.maximumSourceSeconds
      ?? 420,
  ),
))

if (process.argv.includes('--help')) {
  console.log(`Usage: npm run capture:ai-plugin-demo -- [--dry-run | --launch-smoke] [--keep-temp]
  [--cordisx-root /absolute/cordisx] [--app /Applications/ChatGPT.app]
  [--auth /absolute/auth.json] [--output-dir /absolute/motion]
  [--poster-dir /absolute/screenshots] [--output-basename name]
  [--language en|zh] [--theme dark|light] [--effect-selector selector] [--max-agent-seconds 420]

--dry-run creates and checks the isolated workspace and exercises both encoders.
It does not read authentication, launch Codex Desktop, send a prompt, or emit a
publishable demo.

--launch-smoke additionally launches the isolated real Codex renderer, confirms
the composer and baseline local-development generation, and records only a
temporary codec sample. It does not send the prompt or claim the effect.`)
  process.exit(0)
}

if (dryRun && launchSmoke) throw new Error('--dry-run and --launch-smoke are mutually exclusive')
if (!['en', 'zh'].includes(captureLanguage)) throw new Error('--language must be en or zh')
if (!['dark', 'light'].includes(captureTheme)) throw new Error('--theme must be dark or light')
if (!Number.isFinite(maximumAgentSeconds) || maximumAgentSeconds < 30 || maximumAgentSeconds > 1_800) {
  throw new Error('--max-agent-seconds must be between 30 and 1800')
}
if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(outputBasename)) {
  throw new Error('--output-basename must be a filesystem-safe lowercase name')
}

const presentation = AI_PLUGIN_DEMO_PRESENTATIONS[captureLanguage]
const scene = {
  ...aiPluginDemoScene,
  id: `cordisx-ai-plugin-demo.${presentation.locale}.${captureTheme}.v4`,
  locale: presentation.locale,
  language: presentation.language,
  theme: captureTheme,
  selectors: { ...aiPluginDemoScene.selectors, effect: effectSelector },
  timeline: aiPluginDemoScene.timeline.map(item =>
    item.id === 'user-request'
      ? { ...item, text: presentation.prompt }
      : item.id === 'proof-message'
      ? { ...item, text: presentation.proofMessage }
      : item
  ),
}
const cliEntry = path.join(cordisxRoot, 'packages', 'cli', 'dist', 'src', 'cli.js')
const creatorEntry = path.join(cordisxRoot, 'packages', 'create-cordisx-plugin', 'dist', 'cli.js')
const cordisxNodeModules = path.join(cordisxRoot, 'node_modules')
const pluginSkill = path.join(cordisxRoot, 'skills', 'cordisx-plugin-development')
const motionCursorSvg = await readFile(path.join(projectRoot, 'assets', 'capture', 'cordisx-motion-cursor.svg'), 'utf8')
const captureRoot = await mkdtemp(path.join(os.tmpdir(), 'cordisx-ai-plugin-demo-'))
const homeRoot = path.join(captureRoot, 'home')
const codexHome = path.join(captureRoot, 'codex-home')
const cordisxHome = path.join(captureRoot, 'cordisx-home')
const profileDirectory = path.join(captureRoot, 'chromium-profile')
const workspaceDirectory = path.join(captureRoot, 'ai-plugin-demo')
const pluginDirectory = path.join(workspaceDirectory, 'send-confetti')
const framesDirectory = path.join(captureRoot, 'frames')
const smokeDirectory = path.join(captureRoot, 'codec-smoke')
const pluginEntry = path.join(pluginDirectory, 'src', 'send-confetti.tsx')
const appLauncher = path.join(captureRoot, 'launch-codex-app')
const playbackFramesDirectory = path.join(captureRoot, 'playback-frames')
const computerUseApp = path.join(codexHome, 'computer-use', 'Codex Computer Use.app')
const computerUseExecutable = path.join(computerUseApp, 'Contents', 'MacOS', 'SkyComputerUseService')

function executable(name) {
  execFileSync(name, ['-version'], { stdio: 'ignore' })
}

async function requirePath(target, label) {
  await access(target).catch(error => {
    throw new Error(`${label} is unavailable: ${target}`, { cause: error })
  })
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
    const timer = setTimeout(() => {
      child.off('exit', onExit)
      resolve(false)
    }, timeout)
    const onExit = () => {
      clearTimeout(timer)
      resolve(true)
    }
    child.once('exit', onExit)
  })
}

async function stop(child) {
  if (child === undefined || exited(child)) return
  for (const [signal, timeout] of [['SIGINT', 8_000], ['SIGTERM', 5_000], ['SIGKILL', 2_000]]) {
    try {
      process.kill(-child.pid, signal)
    } catch (error) {
      if (error?.code !== 'ESRCH') throw error
    }
    if (await waitForExit(child, timeout)) return
  }
}

function profileProcessIds(profilePath) {
  return execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' })
    .split('\n')
    .flatMap(line => {
      const match = /^\s*(\d+)\s+(.*)$/u.exec(line)
      if (match === null || !match[2].includes(profilePath)) return []
      return [Number(match[1])]
    })
    .filter(pid => Number.isInteger(pid) && pid > 0 && pid !== process.pid)
}

async function stopProfileProcesses(profilePath) {
  for (const [signal, attempts] of [['SIGTERM', 40], ['SIGKILL', 20]]) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const pids = profileProcessIds(profilePath)
      if (pids.length === 0) return
      for (const pid of pids) {
        try {
          process.kill(pid, signal)
        } catch (error) {
          if (error?.code !== 'ESRCH') throw error
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  const remaining = profileProcessIds(profilePath)
  if (remaining.length > 0) throw new Error(`Could not stop isolated profile processes: ${remaining.join(', ')}`)
}

async function copyIfPresent(source, destination) {
  try {
    await copyFile(source, destination)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

async function prepareWorkspace() {
  await Promise.all([
    mkdir(homeRoot, { recursive: true, mode: 0o700 }),
    mkdir(codexHome, { recursive: true, mode: 0o700 }),
    mkdir(cordisxHome, { recursive: true, mode: 0o700 }),
    mkdir(profileDirectory, { recursive: true, mode: 0o700 }),
    mkdir(path.dirname(computerUseExecutable), { recursive: true, mode: 0o700 }),
  ])
  await cp(fixtureRoot, workspaceDirectory, { recursive: true })
  const fixtureNodeModules = path.join(workspaceDirectory, 'node_modules')
  const fixtureBin = path.join(fixtureNodeModules, '.bin')
  await mkdir(path.join(fixtureNodeModules, '@deepseek-ai'), { recursive: true })
  await mkdir(fixtureBin, { recursive: true })
  await Promise.all([
    symlink(path.join(cordisxRoot, 'packages', 'cli'), path.join(fixtureNodeModules, 'cordisx'), 'dir'),
    symlink(
      path.join(cordisxNodeModules, '@deepseek-ai', 'cordis'),
      path.join(fixtureNodeModules, '@deepseek-ai', 'cordis'),
      'dir',
    ),
    symlink(path.join(cordisxNodeModules, 'typescript'), path.join(fixtureNodeModules, 'typescript'), 'dir'),
  ])
  await writeFile(
    path.join(fixtureBin, 'cordisx'),
    `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(cliEntry)} "$@"\n`,
    { mode: 0o700 },
  )
  await writeFile(
    path.join(fixtureBin, 'tsc'),
    `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${
      JSON.stringify(path.join(cordisxNodeModules, 'typescript', 'bin', 'tsc'))
    } "$@"\n`,
    { mode: 0o700 },
  )
  execFileSync(process.execPath, [creatorEntry, 'send-confetti'], {
    cwd: workspaceDirectory,
    env: isolatedEnvironment(),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  await cp(pluginSkill, path.join(codexHome, 'skills', 'cordisx-plugin-development'), { recursive: true })
  await writeFile(computerUseExecutable, '#!/bin/sh\nexec /bin/sleep 3600\n', { mode: 0o700 })
  await chmod(computerUseExecutable, 0o700)
  await writeFile(
    appLauncher,
    `#!/bin/sh
exec /usr/bin/open -n -F -W \\
  --env "HOME=$HOME" \\
  --env "CODEX_HOME=$CODEX_HOME" \\
  --env "CORDISX_HOME=$CORDISX_HOME" \\
  --env "LANG=$LANG" \\
  --env "LC_ALL=$LC_ALL" \\
  --env "LANGUAGE=$LANGUAGE" \\
  --env "CODEX_ELECTRON_SKIP_COMPUTER_USE_CANONICAL_REFRESH=1" \\
  --env "CODEX_ELECTRON_COMPUTER_USE_APP_PATH=$CODEX_ELECTRON_COMPUTER_USE_APP_PATH" \\
  ${JSON.stringify(appBundle)} --args "$@"
`,
    { mode: 0o700 },
  )
  await chmod(appLauncher, 0o700)
  const creatorManifest = JSON.parse(
    await readFile(path.join(cordisxRoot, 'packages', 'create-cordisx-plugin', 'package.json'), 'utf8'),
  )
  const generatedManifest = JSON.parse(await readFile(path.join(pluginDirectory, 'package.json'), 'utf8'))
  return Object.freeze({
    generator: 'create-cordisx-plugin',
    generatorVersion: creatorManifest.version,
    project: 'send-confetti',
    packageName: generatedManifest.name,
    entry: 'send-confetti/src/send-confetti.tsx',
    private: generatedManifest.private === true,
  })
}

function isolatedEnvironment() {
  return {
    ...process.env,
    HOME: homeRoot,
    CODEX_HOME: codexHome,
    CORDISX_HOME: cordisxHome,
    LANG: presentation.environmentLocale,
    LC_ALL: presentation.environmentLocale,
    LANGUAGE: presentation.locale,
    CORDISX_CDP_INJECTION_TIMEOUT_MS: '300000',
    CODEX_ELECTRON_SKIP_COMPUTER_USE_CANONICAL_REFRESH: '1',
    CODEX_ELECTRON_COMPUTER_USE_APP_PATH: computerUseApp,
  }
}

function runFixtureCheck() {
  execFileSync('npm', ['run', 'check'], {
    cwd: pluginDirectory,
    env: isolatedEnvironment(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const output = execFileSync('npm', ['run', 'dev:dry-run'], {
    cwd: pluginDirectory,
    env: isolatedEnvironment(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (!output.includes('"status": "ready"') || !output.includes('"pluginId": "send-confetti"')) {
    throw new Error(`CordisX dry-run did not report the scaffolded send-confetti entry as ready:\n${output}`)
  }
  return output
}

function encodeFrames(sourceDirectory, destinationDirectory, basename, frameRate = scene.output.frameRate) {
  const pattern = path.join(sourceDirectory, 'frame-%06d.jpg')
  const mp4 = path.join(destinationDirectory, `${basename}.mp4`)
  const webm = path.join(destinationDirectory, `${basename}.webm`)
  const gif = path.join(destinationDirectory, `${basename}.gif`)
  execFileSync('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-framerate',
    String(frameRate),
    '-i',
    pattern,
    '-vf',
    `scale=${scene.output.width}:${scene.output.height}:force_original_aspect_ratio=decrease:flags=lanczos:in_range=full:out_range=tv,pad=${scene.output.width}:${scene.output.height}:(ow-iw)/2:(oh-ih)/2:color=black,format=${scene.output.pixelFormat},setsar=1`,
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '20',
    '-pix_fmt',
    scene.output.pixelFormat,
    '-movflags',
    '+faststart',
    mp4,
  ], { stdio: 'inherit' })
  execFileSync('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-framerate',
    String(frameRate),
    '-i',
    pattern,
    '-vf',
    `scale=${scene.output.width}:${scene.output.height}:force_original_aspect_ratio=decrease:flags=lanczos:in_range=full:out_range=tv,pad=${scene.output.width}:${scene.output.height}:(ow-iw)/2:(oh-ih)/2:color=black,format=${scene.output.pixelFormat},setsar=1`,
    '-c:v',
    'libvpx-vp9',
    '-crf',
    '31',
    '-b:v',
    '0',
    '-row-mt',
    '1',
    '-pix_fmt',
    scene.output.pixelFormat,
    webm,
  ], { stdio: 'inherit' })
  execFileSync('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-framerate',
    String(frameRate),
    '-i',
    pattern,
    '-filter_complex',
    `[0:v]fps=${scene.output.gif.frameRate},scale=${scene.output.gif.width}:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=${scene.output.gif.maxColors}:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`,
    '-loop',
    '0',
    gif,
  ], { stdio: 'inherit' })
  return { mp4, webm, gif }
}

async function materializePlaybackFrames(timeline) {
  await mkdir(playbackFramesDirectory, { recursive: true })
  const playback = selectPlaybackTimeline(
    timeline,
    scene.playback.acceleratedSegments,
    scene.output.frameRate,
  )
  for (const item of playback.timeline) {
    await copyFile(
      path.join(framesDirectory, `frame-${String(item.sourceFrame).padStart(6, '0')}.jpg`),
      path.join(playbackFramesDirectory, `frame-${String(item.frame).padStart(6, '0')}.jpg`),
    )
  }
  return playback
}

async function codecSmoke() {
  await mkdir(smokeDirectory, { recursive: true })
  execFileSync('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    `color=c=0x181818:s=${scene.output.width}x${scene.output.height}:r=${scene.output.frameRate}:d=1`,
    '-frames:v',
    String(scene.output.frameRate),
    path.join(smokeDirectory, 'frame-%06d.jpg'),
  ], { stdio: 'inherit' })
  const outputs = encodeFrames(smokeDirectory, smokeDirectory, 'infrastructure-only')
  execFileSync(process.execPath, [
    path.join(import.meta.dirname, 'verify-ai-plugin-demo.mjs'),
    '--mp4',
    outputs.mp4,
    '--webm',
    outputs.webm,
    '--gif',
    outputs.gif,
    '--infrastructure-only',
  ], { stdio: 'inherit' })
}

async function prepareAuthentication() {
  await copyFile(authFile, path.join(codexHome, 'auth.json'))
  const sourceCodexHome = path.dirname(authFile)
  for (
    const preferenceFile of [
      '.personality_migration',
      '.sandbox_migration',
      '.app-server-state-reconciled-v1',
    ]
  ) {
    await copyIfPresent(path.join(sourceCodexHome, preferenceFile), path.join(codexHome, preferenceFile))
  }
  await writeFile(
    path.join(codexHome, '.codex-global-state.json'),
    `${
      JSON.stringify(
        {
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
        },
        null,
        2,
      )
    }\n`,
    { mode: 0o600 },
  )
  await writeFile(
    path.join(codexHome, 'config.toml'),
    `approval_policy = "never"
sandbox_mode = "workspace-write"

[desktop]
appearanceTheme = "${scene.theme}"
localeOverride = "${scene.locale}"
appearanceDarkChromeTheme = { accent = "#339cff", contrast = 60, fonts = { code = "", ui = "" }, ink = "#ffffff", opaqueWindows = true, semanticColors = { diffAdded = "#40c977", diffRemoved = "#fa423e", skill = "#ad7bf9" }, surface = "#181818" }
appearanceLightChromeTheme = { accent = "#339cff", contrast = 45, fonts = { code = "", ui = "" }, ink = "#1a1c1f", opaqueWindows = true, semanticColors = { diffAdded = "#00a240", diffRemoved = "#ba2623", skill = "#924ff7" }, surface = "#ffffff" }
`,
    { mode: 0o600 },
  )
  const sourceRuntimeCache = path.join(os.homedir(), '.cache', 'codex-runtimes')
  const destinationCache = path.join(homeRoot, '.cache')
  await mkdir(destinationCache, { recursive: true, mode: 0o700 })
  execFileSync('/bin/cp', ['-cR', sourceRuntimeCache, destinationCache], { stdio: 'inherit' })
}

async function waitForTarget(port, child) {
  for (let attempt = 0; attempt < 1_200; attempt += 1) {
    if (exited(child)) throw new Error(`CordisX launcher exited before Codex became ready (${String(child.exitCode)})`)
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(700) })
      if (response.ok) {
        const targets = await response.json()
        const target = targets.find(item => item.type === 'page' && item.url === 'app://-/index.html')
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
      sourceChanged && replacementGeneration !== null && !state.busy && state.composer !== null && state.submit !== null
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

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex')
}

let launcher
let socket
let interrupted = false
let cleanupPromise
const cleanup = () =>
  cleanupPromise ??= (async () => {
    socket?.close()
    await stop(launcher)
    await stopProfileProcesses(profileDirectory)
    if (!keepTemporaryFiles) await rm(captureRoot, { recursive: true, force: true, maxRetries: 12, retryDelay: 200 })
  })()
const interrupt = signal => {
  if (interrupted) return
  interrupted = true
  process.stderr.write(`\nAI plugin demo capture interrupted by ${signal}; cleaning isolated processes...\n`)
  void cleanup().finally(() => process.exit(130))
}
const onSigint = () => interrupt('SIGINT')
const onSigterm = () => interrupt('SIGTERM')
process.once('SIGINT', onSigint)
process.once('SIGTERM', onSigterm)

try {
  executable('ffmpeg')
  executable('ffprobe')
  await Promise.all([
    requirePath(cliEntry, 'built CordisX CLI (run npm ci && npm run build in the CordisX checkout)'),
    requirePath(creatorEntry, 'built create-cordisx-plugin CLI (run npm ci && npm run build in the CordisX checkout)'),
    requirePath(cordisxNodeModules, 'CordisX node_modules (run npm ci in the CordisX checkout)'),
    requirePath(pluginSkill, 'CordisX plugin-development skill'),
    requirePath(fixtureRoot, 'AI plugin demo fixture'),
  ])
  const cordisxCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: cordisxRoot,
    encoding: 'utf8',
  }).trim()
  if (cordisxCommit !== AI_PLUGIN_DEMO_HOST_COMMIT) {
    throw new Error(`CordisX checkpoint mismatch: expected ${AI_PLUGIN_DEMO_HOST_COMMIT}, received ${cordisxCommit}`)
  }
  const scaffold = await prepareWorkspace()
  runFixtureCheck()

  if (dryRun) {
    await codecSmoke()
    console.log(JSON.stringify(
      {
        status: 'ready',
        mode: 'infrastructure-dry-run',
        realRenderer: false,
        promptSent: false,
        effectClaimed: false,
        scene: scene.id,
        scaffold,
        workspaceCheck: 'passed',
        codecSmoke: ['h264/yuv420p/faststart', 'vp9/yuv420p'],
        temporaryFilesRetained: keepTemporaryFiles,
        ...(keepTemporaryFiles ? { temporaryRoot: captureRoot } : {}),
      },
      null,
      2,
    ))
    process.exitCode = 0
  } else {
    await Promise.all([
      requirePath(appBundle, 'Codex Desktop app bundle'),
      requirePath(authFile, 'Codex authentication state'),
    ])
    await prepareAuthentication()
    await mkdir(framesDirectory, { recursive: true })
    const port = await availablePort()
    const sourceBefore = await readFile(pluginEntry, 'utf8')
    const sourceMetadataBefore = await stat(pluginEntry)
    const launchStartedAt = new Date().toISOString()
    launcher = spawn(process.execPath, [
      cliEntry,
      'dev',
      pluginEntry,
      '--executable',
      appLauncher,
      '--debug-port',
      String(port),
      '--profile-dir',
      profileDirectory,
      '--',
      '--start-minimized',
      `--lang=${scene.locale}`,
      '--window-size=1600,1000',
      '--force-color-profile=srgb',
    ], {
      cwd: workspaceDirectory,
      env: isolatedEnvironment(),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    })
    launcher.stdout.on('data', chunk => process.stdout.write(chunk))
    launcher.stderr.on('data', chunk => process.stderr.write(chunk))

    const target = await waitForTarget(port, launcher)
    const connection = connect(target.webSocketDebuggerUrl)
    socket = connection.socket
    const { send } = connection
    await send('Runtime.enable')
    await send('Page.enable')
    await waitForRuntime(send)
    const onboarding = await finishOnboarding(send)
    await setCapturePresentation(send)
    await installPointer(send)

    const privacy = await evaluate(
      send,
      `(() => ({
      profileSanitized: [...document.querySelectorAll('button')].some(button => button.getAttribute('aria-label') === 'CordisX Demo profile'),
      visibleProjectNames: [...document.querySelectorAll('[data-project-id], [data-thread-id]')].filter(element => element instanceof HTMLElement && element.offsetParent !== null).length,
      locale: document.documentElement.lang,
    }))()`,
    )
    if (!privacy.profileSanitized) throw new Error('Could not sanitize the visible profile identity before capture')
    if (privacy.visibleProjectNames !== 0) {
      throw new Error('Isolated capture unexpectedly exposed project or thread records')
    }

    const recorder = new FrameRecorder(send)
    await recorder.hold(12, 'opening')
    const baselineGeneration = await waitForInitialGeneration(send, recorder)
    if (launchSmoke) {
      const state = await composerState(send)
      if (state.composer === null || state.submit === null) {
        throw new Error('Launch smoke could not resolve the real composer and native submit control')
      }
      await recorder.hold(12, 'launch-smoke-ready')
      await mkdir(smokeDirectory, { recursive: true })
      const smokeOutputs = encodeFrames(framesDirectory, smokeDirectory, 'real-renderer-infrastructure-only')
      execFileSync(process.execPath, [
        path.join(import.meta.dirname, 'verify-ai-plugin-demo.mjs'),
        '--mp4',
        smokeOutputs.mp4,
        '--webm',
        smokeOutputs.webm,
        '--gif',
        smokeOutputs.gif,
        '--infrastructure-only',
      ], { stdio: 'inherit' })
      console.log(JSON.stringify(
        {
          status: 'ready',
          mode: 'real-renderer-launch-smoke',
          realRenderer: true,
          rendererUrl: 'app://-/index.html',
          promptSent: false,
          effectClaimed: false,
          baselineGeneration,
          composerResolved: true,
          nativeSubmitResolved: true,
          privacy,
          frameCount: recorder.frameCount,
          temporaryFilesRetained: keepTemporaryFiles,
          ...(keepTemporaryFiles ? { temporaryRoot: captureRoot } : {}),
        },
        null,
        2,
      ))
    } else {
      await typeIntoComposer(send, recorder, presentation.prompt, 'user-request', 1)
      await clickNativeSubmit(send, recorder, 'submit-request')
      const submitted = await evaluate(send, `document.body.innerText.includes(${JSON.stringify(presentation.prompt)})`)
      if (!submitted) throw new Error('The exact localized request was not visible after the real native submit click')

      const replacement = await waitForAgentAndReplacement(send, recorder, baselineGeneration, sourceBefore)
      await recorder.hold(12, 'generation-ready')
      const proof = scene.timeline.find(item => item.id === 'proof-message')
      await typeIntoComposer(send, recorder, proof.text, 'proof-message', proof.framesPerCharacter)
      await clickNativeSubmit(send, recorder, 'submit-proof')
      const stagingDirectory = path.join(captureRoot, 'encoded')
      await mkdir(stagingDirectory, { recursive: true })
      const stagedPoster = path.join(stagingDirectory, `${outputBasename}.png`)
      const effect = await waitForEffect(send, recorder)
      await capturePoster(send, stagedPoster)
      await recorder.hold(42, 'confetti-visible')
      Object.assign(effect, await waitForEffectCleanup(send, recorder))
      const settings = await openScaffoldedPluginDetails(send, recorder)
      const playback = await materializePlaybackFrames(recorder.timeline)
      const encoded = encodeFrames(playbackFramesDirectory, stagingDirectory, outputBasename)
      const sourceAfter = await readFile(pluginEntry, 'utf8')
      const sourceMetadataAfter = await stat(pluginEntry)
      const stagedSource = path.join(stagingDirectory, `${outputBasename}.plugin.tsx`)
      await writeFile(stagedSource, sourceAfter)
      const metadata = {
        schemaVersion: 2,
        scene: scene.id,
        realRenderer: true,
        rendererUrl: 'app://-/index.html',
        prompt: presentation.prompt,
        promptSubmitted: true,
        finalSubmitClicked: true,
        effectObserved: true,
        effect,
        settings,
        scaffold,
        plugin: {
          id: 'send-confetti',
          sourceChanged: sourceAfter !== sourceBefore,
          sourceMtimeChanged: sourceMetadataAfter.mtimeMs !== sourceMetadataBefore.mtimeMs,
          sourceSha256: `sha256:${createHash('sha256').update(sourceAfter).digest('hex')}`,
          baselineGeneration,
          replacementGeneration: replacement.replacementGeneration,
          generationChanged: replacement.replacementGeneration !== baselineGeneration,
        },
        checkpoints: {
          host: cordisxCommit,
          protocol: AI_PLUGIN_DEMO_PROTOCOL_COMMIT,
        },
        capture: {
          launchStartedAt,
          finishedAt: new Date().toISOString(),
          sourceDurationSeconds: Number(((Date.now() - recorder.startedAt) / 1_000).toFixed(3)),
          encodedDurationSeconds: Number((playback.frameCount / scene.output.frameRate).toFixed(3)),
          frameCount: playback.frameCount,
          sourceFrameCount: playback.sourceFrameCount,
          frameRate: scene.output.frameRate,
          width: scene.output.width,
          height: scene.output.height,
          theme: scene.theme,
          language: scene.language,
          locale: scene.locale,
          acceleratedSegments: scene.playback.acceleratedSegments,
          timeline: playback.timeline,
        },
        privacy: {
          isolatedHome: true,
          isolatedCodexHome: true,
          isolatedCordisXHome: true,
          isolatedChromiumProfile: true,
          emptyProjectAndThreadState: true,
          visibleProfileIdentity: 'CordisX Demo',
          authenticationCopiedForRuntimeOnly: true,
          authenticationPublished: false,
        },
        onboarding,
      }
      const stagedMetadata = path.join(stagingDirectory, `${outputBasename}.json`)
      await writeFile(stagedMetadata, `${JSON.stringify(metadata, null, 2)}\n`)
      execFileSync(process.execPath, [
        path.join(import.meta.dirname, 'verify-ai-plugin-demo.mjs'),
        '--mp4',
        encoded.mp4,
        '--webm',
        encoded.webm,
        '--gif',
        encoded.gif,
        '--poster',
        stagedPoster,
        '--metadata',
        stagedMetadata,
        '--source',
        stagedSource,
      ], { stdio: 'inherit' })

      await Promise.all([mkdir(outputDirectory, { recursive: true }), mkdir(posterDirectory, { recursive: true })])
      const final = {
        mp4: path.join(outputDirectory, `${outputBasename}.mp4`),
        webm: path.join(outputDirectory, `${outputBasename}.webm`),
        gif: path.join(outputDirectory, `${outputBasename}.gif`),
        metadata: path.join(outputDirectory, `${outputBasename}.json`),
        source: path.join(outputDirectory, `${outputBasename}.plugin.tsx`),
        poster: path.join(posterDirectory, `${outputBasename}.png`),
      }
      await Promise.all([
        rename(encoded.mp4, final.mp4),
        rename(encoded.webm, final.webm),
        rename(encoded.gif, final.gif),
        rename(stagedMetadata, final.metadata),
        rename(stagedSource, final.source),
        rename(stagedPoster, final.poster),
      ])
      console.log(JSON.stringify(
        {
          status: 'captured',
          outputs: final,
          frameCount: playback.frameCount,
          sourceFrameCount: playback.sourceFrameCount,
          sourceDurationSeconds: metadata.capture.sourceDurationSeconds,
          encodedDurationSeconds: metadata.capture.encodedDurationSeconds,
          resolution: `${scene.output.width}x${scene.output.height}`,
          mp4: {
            codec: 'h264',
            pixelFormat: scene.output.pixelFormat,
            faststart: true,
            sha256: await sha256(final.mp4),
          },
          webm: { codec: 'vp9', pixelFormat: scene.output.pixelFormat, sha256: await sha256(final.webm) },
          gif: {
            codec: 'gif',
            width: scene.output.gif.width,
            frameRate: scene.output.gif.frameRate,
            sha256: await sha256(final.gif),
          },
          source: { sha256: metadata.plugin.sourceSha256 },
          effect,
          settings,
          scaffold,
          privacy: metadata.privacy,
          temporaryFilesRetained: keepTemporaryFiles,
          ...(keepTemporaryFiles ? { temporaryRoot: captureRoot } : {}),
        },
        null,
        2,
      ))
    }
  }
} finally {
  process.off('SIGINT', onSigint)
  process.off('SIGTERM', onSigterm)
  await cleanup()
}

// Node's built-in WebSocket can retain an idle CDP handle after the isolated
// renderer and every owned profile process have already exited.
process.exit(0)
