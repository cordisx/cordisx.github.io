#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  AI_PLUGIN_DEMO_HOST_COMMIT,
  AI_PLUGIN_DEMO_PROMPT,
  AI_PLUGIN_DEMO_PROTOCOL_COMMIT,
  aiPluginDemoScene,
} from './ai-plugin-demo-scene.mjs'

function option(name) {
  const index = process.argv.indexOf(name)
  if (index < 0) return undefined
  const value = process.argv[index + 1]
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} requires a value`)
  return path.resolve(value)
}

if (process.argv.includes('--help')) {
  console.log('Usage: node scripts/verify-ai-plugin-demo.mjs --mp4 file --webm file --gif file [--poster file --metadata file --source file] [--infrastructure-only]')
  process.exit(0)
}

const infrastructureOnly = process.argv.includes('--infrastructure-only')
const files = {
  mp4: option('--mp4'),
  webm: option('--webm'),
  gif: option('--gif'),
  poster: option('--poster'),
  metadata: option('--metadata'),
  source: option('--source'),
}
if (files.mp4 === undefined || files.webm === undefined || files.gif === undefined) throw new Error('--mp4, --webm, and --gif are required')
if (!infrastructureOnly && (files.poster === undefined || files.metadata === undefined || files.source === undefined)) {
  throw new Error('Real demo verification requires --poster, --metadata, and --source')
}

function probe(file) {
  return JSON.parse(execFileSync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name,width,height,pix_fmt,nb_frames,r_frame_rate,duration:format=format_name,duration',
    '-of', 'json',
    file,
  ], { encoding: 'utf8' }))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function number(value) {
  const result = Number(value)
  return Number.isFinite(result) ? result : undefined
}

function video(file, expectedCodec, {
  pixelFormat = 'yuv420p',
  minimumWidth = 1280,
  minimumHeight = 720,
} = {}) {
  const result = probe(file)
  const stream = result.streams?.[0]
  assert(stream !== undefined, `${file} has no video stream`)
  assert(stream.codec_name === expectedCodec, `${file} codec is ${String(stream.codec_name)}, expected ${expectedCodec}`)
  if (pixelFormat !== null) assert(stream.pix_fmt === pixelFormat, `${file} pixel format is ${String(stream.pix_fmt)}, expected ${pixelFormat}`)
  assert(number(stream.width) >= minimumWidth, `${file} width is below ${minimumWidth}`)
  assert(number(stream.height) >= minimumHeight, `${file} height is below ${minimumHeight}`)
  const duration = number(result.format?.duration) ?? number(stream.duration)
  assert(duration !== undefined && duration >= (infrastructureOnly ? 0.8 : 3), `${file} duration is invalid`)
  const frames = number(stream.nb_frames)
  if (frames !== undefined) assert(frames >= (infrastructureOnly ? 8 : 36), `${file} frame count is too small`)
  return {
    codec: stream.codec_name,
    pixelFormat: stream.pix_fmt,
    width: Number(stream.width),
    height: Number(stream.height),
    duration,
    ...(frames === undefined ? {} : { frames }),
    frameRate: stream.r_frame_rate,
    format: result.format?.format_name,
  }
}

const mp4 = video(files.mp4, 'h264')
const webm = video(files.webm, 'vp9')
const gif = video(files.gif, 'gif', {
  pixelFormat: null,
  minimumWidth: aiPluginDemoScene.output.gif.width,
  minimumHeight: aiPluginDemoScene.output.gif.height,
})
assert(gif.width === aiPluginDemoScene.output.gif.width, `${files.gif} width drifted from the scene`)
assert(gif.height === aiPluginDemoScene.output.gif.height, `${files.gif} height drifted from the scene`)
assert(gif.frameRate === `${aiPluginDemoScene.output.gif.frameRate}/1`, `${files.gif} frame rate drifted from the scene`)
const mp4Bytes = await readFile(files.mp4)
const moov = mp4Bytes.indexOf(Buffer.from('moov'))
const mdat = mp4Bytes.indexOf(Buffer.from('mdat'))
assert(moov >= 0 && mdat >= 0 && moov < mdat, `${files.mp4} does not place the moov atom before mdat (faststart)`)

let poster
let metadata
let source
if (!infrastructureOnly) {
  const posterProbe = probe(files.poster)
  const posterStream = posterProbe.streams?.[0]
  assert(posterStream?.codec_name === 'png', `${files.poster} is not a PNG poster`)
  assert(Number(posterStream.width) === aiPluginDemoScene.output.width, `${files.poster} width drifted from the scene`)
  assert(Number(posterStream.height) === aiPluginDemoScene.output.height, `${files.poster} height drifted from the scene`)
  poster = { codec: 'png', width: Number(posterStream.width), height: Number(posterStream.height) }

  metadata = JSON.parse(await readFile(files.metadata, 'utf8'))
  source = await readFile(files.source, 'utf8')
  assert(metadata.schemaVersion === 2, 'capture metadata schema version is not 2')
  assert(metadata.scene === aiPluginDemoScene.id, 'capture metadata scene drifted')
  assert(metadata.realRenderer === true, 'capture metadata does not prove a real renderer')
  assert(metadata.rendererUrl === 'app://-/index.html', 'capture metadata renderer URL is not the real Codex app target')
  assert(metadata.prompt === AI_PLUGIN_DEMO_PROMPT, 'capture metadata does not contain the exact required Chinese prompt')
  assert(metadata.promptSubmitted === true, 'capture metadata does not prove prompt submission')
  assert(metadata.finalSubmitClicked === true, 'capture metadata does not prove the final native submit click')
  assert(metadata.effectObserved === true, 'capture metadata does not prove the full-screen effect')
  assert(metadata.effect?.selector === '[data-cordisx-effect="confetti"]', 'capture metadata effect marker drifted')
  assert(metadata.effect?.cleanupObserved === true, 'capture metadata does not prove Host effect cleanup')
  assert(typeof metadata.effect?.cleanedAt === 'string', 'capture metadata is missing the Host effect cleanup timestamp')
  assert(metadata.scaffold?.generator === 'create-cordisx-plugin', 'capture metadata does not prove the public creator was used')
  assert(metadata.scaffold?.project === 'send-confetti', 'capture scaffold project drifted')
  assert(metadata.scaffold?.packageName === 'send-confetti', 'capture scaffold package name drifted')
  assert(metadata.scaffold?.entry === 'send-confetti/src/send-confetti.tsx', 'capture scaffold entry drifted')
  assert(metadata.scaffold?.private === true, 'new scaffold must remain private until publication is requested')
  assert(metadata.plugin?.id === 'send-confetti', 'capture metadata plugin id drifted')
  assert(metadata.plugin?.sourceChanged === true, 'capture metadata does not prove a real source edit')
  assert(metadata.plugin?.sourceMtimeChanged === true, 'capture metadata does not prove the scaffold entry was rewritten')
  assert(metadata.plugin?.generationChanged === true, 'capture metadata does not prove a replacement generation')
  assert(metadata.plugin?.baselineGeneration !== metadata.plugin?.replacementGeneration, 'plugin generations are identical')
  assert(metadata.plugin?.sourceSha256 === `sha256:${createHash('sha256').update(source).digest('hex')}`, 'published plugin source does not match capture metadata')
  assert(metadata.settings?.pluginId === 'send-confetti', 'capture metadata does not prove the scaffolded plugin detail was opened')
  assert(metadata.settings?.localDevelopment === true, 'plugin detail does not identify the project as local development')
  assert(metadata.settings?.simplifiedChineseReadme === true, 'plugin detail did not render the Simplified Chinese README')
  assert(metadata.settings?.listSelector === '[data-plugin-id="send-confetti"]', 'plugin list evidence selector drifted')
  assert(metadata.settings?.detailSelector === '[data-plugin-detail="send-confetti"]', 'plugin detail evidence selector drifted')
  assert(metadata.checkpoints?.host === AI_PLUGIN_DEMO_HOST_COMMIT, 'capture metadata Host checkpoint drifted')
  assert(metadata.checkpoints?.protocol === AI_PLUGIN_DEMO_PROTOCOL_COMMIT, 'capture metadata protocol checkpoint drifted')
  assert(metadata.privacy?.authenticationPublished === false, 'capture metadata claims authentication was published')
  assert(metadata.privacy?.emptyProjectAndThreadState === true, 'capture metadata does not prove empty private UI state')
  assert(metadata.capture?.frameCount >= 36, 'capture metadata frame count is too small')
  assert(metadata.capture?.sourceFrameCount > metadata.capture?.frameCount, 'capture metadata does not prove an accelerated source segment')
  assert(metadata.capture?.width === aiPluginDemoScene.output.width, 'capture metadata width drifted')
  assert(metadata.capture?.height === aiPluginDemoScene.output.height, 'capture metadata height drifted')
  assert(metadata.capture?.frameRate === aiPluginDemoScene.output.frameRate, 'capture metadata frame rate drifted')
  assert(metadata.capture?.theme === 'dark' && metadata.capture?.locale === 'zh-CN', 'capture presentation is not explicit zh-CN/dark')
  assert(Array.isArray(metadata.capture?.timeline) && metadata.capture.timeline.length === metadata.capture.frameCount, 'capture timeline does not account for every frame')
  assert(metadata.capture.acceleratedSegments?.['codex-builds-and-cordisx-loads'] === 5, 'Agent work segment is not encoded at 5x')
  assert(metadata.capture.timeline.every((item, index) => item.frame === index), 'encoded frame ledger is not contiguous')
  assert(metadata.capture.timeline.every((item, index, items) => index === 0 || item.sourceFrame > items[index - 1].sourceFrame), 'source frame ledger is not strictly increasing')
  assert(metadata.capture.timeline.some(item => item.segment === 'codex-builds-and-cordisx-loads' && item.playbackRate === 5), 'frame ledger does not identify the 5x Agent work segment')
  assert(metadata.capture.timeline.every((item, index, items) => index === 0 || item.sourceElapsedMs >= items[index - 1].sourceElapsedMs), 'capture source timeline is not monotonic')
  for (const segment of ['settings-open', 'settings-plugins', 'settings-plugin-open', 'settings-plugin-detail']) {
    assert(metadata.capture.timeline.some(item => item.segment === segment || item.segment.startsWith(`${segment}:`)), `capture timeline is missing ${segment}`)
  }
  assert(/\bid\s*:\s*['"]send-confetti['"]/u.test(source), 'published source does not declare the independent plugin id')
  assert(/\blocale\s*:\s*['"]en['"]/u.test(source), 'published source is missing English localization')
  assert(/\blocale\s*:\s*['"]zh-CN['"]/u.test(source), 'published source is missing zh-CN localization')
  assert(source.includes('cordisx.composer-submit-celebration/v1'), 'published source does not use the public celebration profile')
  assert(!source.includes('natural-language'), 'published source retains the removed proof-of-concept entry name')
  assert(!/querySelector|addEventListener\s*\(/u.test(source), 'published plugin source bypasses Host-owned structured UI')
  assert(Math.abs(mp4.duration - webm.duration) < 0.15, 'MP4 and WebM durations differ materially')
  assert(Math.abs(mp4.duration - gif.duration) < 0.15, 'MP4 and GIF durations differ materially')
  assert(Math.abs(mp4.duration - metadata.capture.encodedDurationSeconds) < 0.15, 'encoded duration differs from capture metadata')
  if (mp4.frames !== undefined) assert(mp4.frames === metadata.capture.frameCount, 'MP4 frame count differs from capture metadata')
}

console.log(JSON.stringify({
  status: 'verified',
  mode: infrastructureOnly ? 'infrastructure-only' : 'real-ai-plugin-demo',
  mp4: { ...mp4, faststart: true },
  webm,
  gif,
  ...(poster === undefined ? {} : { poster }),
  ...(metadata === undefined ? {} : {
    evidence: {
      realRenderer: metadata.realRenderer,
      promptSubmitted: metadata.promptSubmitted,
      sourceChanged: metadata.plugin.sourceChanged,
      generationChanged: metadata.plugin.generationChanged,
      scaffold: metadata.scaffold,
      finalSubmitClicked: metadata.finalSubmitClicked,
      effectObserved: metadata.effectObserved,
      effectCleanupObserved: metadata.effect.cleanupObserved,
      settings: metadata.settings,
      checkpoints: metadata.checkpoints,
      privacy: metadata.privacy,
    },
  }),
}, null, 2))
