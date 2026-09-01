#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { AI_PLUGIN_DEMO_PROMPT, aiPluginDemoScene } from './ai-plugin-demo-scene.mjs'

function option(name) {
  const index = process.argv.indexOf(name)
  if (index < 0) return undefined
  const value = process.argv[index + 1]
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} requires a value`)
  return path.resolve(value)
}

if (process.argv.includes('--help')) {
  console.log('Usage: node scripts/verify-ai-plugin-demo.mjs --mp4 file --webm file [--poster file --metadata file] [--infrastructure-only]')
  process.exit(0)
}

const infrastructureOnly = process.argv.includes('--infrastructure-only')
const files = {
  mp4: option('--mp4'),
  webm: option('--webm'),
  poster: option('--poster'),
  metadata: option('--metadata'),
}
if (files.mp4 === undefined || files.webm === undefined) throw new Error('--mp4 and --webm are required')
if (!infrastructureOnly && (files.poster === undefined || files.metadata === undefined)) {
  throw new Error('Real demo verification requires --poster and --metadata')
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

function video(file, expectedCodec) {
  const result = probe(file)
  const stream = result.streams?.[0]
  assert(stream !== undefined, `${file} has no video stream`)
  assert(stream.codec_name === expectedCodec, `${file} codec is ${String(stream.codec_name)}, expected ${expectedCodec}`)
  assert(stream.pix_fmt === 'yuv420p', `${file} pixel format is ${String(stream.pix_fmt)}, expected yuv420p`)
  assert(number(stream.width) >= 1280, `${file} width is below 1280`)
  assert(number(stream.height) >= 720, `${file} height is below 720`)
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
const mp4Bytes = await readFile(files.mp4)
const moov = mp4Bytes.indexOf(Buffer.from('moov'))
const mdat = mp4Bytes.indexOf(Buffer.from('mdat'))
assert(moov >= 0 && mdat >= 0 && moov < mdat, `${files.mp4} does not place the moov atom before mdat (faststart)`)

let poster
let metadata
if (!infrastructureOnly) {
  const posterProbe = probe(files.poster)
  const posterStream = posterProbe.streams?.[0]
  assert(posterStream?.codec_name === 'png', `${files.poster} is not a PNG poster`)
  assert(Number(posterStream.width) === aiPluginDemoScene.output.width, `${files.poster} width drifted from the scene`)
  assert(Number(posterStream.height) === aiPluginDemoScene.output.height, `${files.poster} height drifted from the scene`)
  poster = { codec: 'png', width: Number(posterStream.width), height: Number(posterStream.height) }

  metadata = JSON.parse(await readFile(files.metadata, 'utf8'))
  assert(metadata.schemaVersion === 1, 'capture metadata schema version is not 1')
  assert(metadata.realRenderer === true, 'capture metadata does not prove a real renderer')
  assert(metadata.rendererUrl === 'app://-/index.html', 'capture metadata renderer URL is not the real Codex app target')
  assert(metadata.prompt === AI_PLUGIN_DEMO_PROMPT, 'capture metadata does not contain the exact required Chinese prompt')
  assert(metadata.promptSubmitted === true, 'capture metadata does not prove prompt submission')
  assert(metadata.finalSubmitClicked === true, 'capture metadata does not prove the final native submit click')
  assert(metadata.effectObserved === true, 'capture metadata does not prove the full-screen effect')
  assert(metadata.effect?.selector === '[data-cordisx-effect="confetti"]', 'capture metadata effect marker drifted')
  assert(metadata.effect?.cleanupObserved === true, 'capture metadata does not prove Host effect cleanup')
  assert(typeof metadata.effect?.cleanedAt === 'string', 'capture metadata is missing the Host effect cleanup timestamp')
  assert(metadata.plugin?.id === 'celebration', 'capture metadata plugin id drifted')
  assert(metadata.plugin?.sourceChanged === true, 'capture metadata does not prove a real source edit')
  assert(metadata.plugin?.generationChanged === true, 'capture metadata does not prove a replacement generation')
  assert(metadata.plugin?.baselineGeneration !== metadata.plugin?.replacementGeneration, 'plugin generations are identical')
  assert(metadata.privacy?.authenticationPublished === false, 'capture metadata claims authentication was published')
  assert(metadata.privacy?.emptyProjectAndThreadState === true, 'capture metadata does not prove empty private UI state')
  assert(metadata.capture?.frameCount >= 36, 'capture metadata frame count is too small')
  assert(metadata.capture?.width === aiPluginDemoScene.output.width, 'capture metadata width drifted')
  assert(metadata.capture?.height === aiPluginDemoScene.output.height, 'capture metadata height drifted')
  assert(metadata.capture?.frameRate === aiPluginDemoScene.output.frameRate, 'capture metadata frame rate drifted')
  assert(metadata.capture?.theme === 'dark' && metadata.capture?.locale === 'zh-CN', 'capture presentation is not explicit zh-CN/dark')
  assert(Array.isArray(metadata.capture?.timeline) && metadata.capture.timeline.length === metadata.capture.frameCount, 'capture timeline does not account for every frame')
  assert(metadata.capture.timeline.every((item, index, items) => index === 0 || item.sourceElapsedMs >= items[index - 1].sourceElapsedMs), 'capture source timeline is not monotonic')
  assert(Math.abs(mp4.duration - webm.duration) < 0.15, 'MP4 and WebM durations differ materially')
  assert(Math.abs(mp4.duration - metadata.capture.encodedDurationSeconds) < 0.15, 'encoded duration differs from capture metadata')
}

console.log(JSON.stringify({
  status: 'verified',
  mode: infrastructureOnly ? 'infrastructure-only' : 'real-ai-plugin-demo',
  mp4: { ...mp4, faststart: true },
  webm,
  ...(poster === undefined ? {} : { poster }),
  ...(metadata === undefined ? {} : {
    evidence: {
      realRenderer: metadata.realRenderer,
      promptSubmitted: metadata.promptSubmitted,
      sourceChanged: metadata.plugin.sourceChanged,
      generationChanged: metadata.plugin.generationChanged,
      finalSubmitClicked: metadata.finalSubmitClicked,
      effectObserved: metadata.effectObserved,
      effectCleanupObserved: metadata.effect.cleanupObserved,
      privacy: metadata.privacy,
    },
  }),
}, null, 2))
