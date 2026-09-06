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
import { createAiPluginDemoRenderer } from './ai-plugin-demo-renderer.mjs'
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

const {
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
} = createAiPluginDemoRenderer({
  scene,
  presentation,
  motionCursorSvg,
  framesDirectory,
  pluginEntry,
  maximumAgentSeconds,
})

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
