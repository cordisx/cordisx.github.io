export function selectPlaybackTimeline(timeline, acceleratedSegments, frameRate) {
  if (!Array.isArray(timeline) || timeline.length === 0) throw new Error('Source timeline is empty')
  if (!Number.isFinite(frameRate) || frameRate <= 0) throw new Error('Frame rate must be positive')
  const playbackTimeline = []
  let runStart = 0
  while (runStart < timeline.length) {
    const segment = timeline[runStart].segment
    let runEnd = runStart + 1
    while (runEnd < timeline.length && timeline[runEnd].segment === segment) runEnd += 1
    const playbackRate = acceleratedSegments[segment] ?? 1
    if (!Number.isInteger(playbackRate) || playbackRate < 1) {
      throw new Error(`Invalid playback rate ${String(playbackRate)} for ${segment}`)
    }
    const selected = []
    for (let sourceIndex = runStart; sourceIndex < runEnd; sourceIndex += playbackRate) selected.push(sourceIndex)
    if (selected.at(-1) !== runEnd - 1) selected.push(runEnd - 1)
    for (const sourceIndex of selected) {
      const source = timeline[sourceIndex]
      const frame = playbackTimeline.length
      playbackTimeline.push({
        ...source,
        frame,
        sourceFrame: source.frame,
        playbackRate,
        encodedElapsedMs: Math.round(frame * 1_000 / frameRate),
      })
    }
    runStart = runEnd
  }
  return {
    frameCount: playbackTimeline.length,
    sourceFrameCount: timeline.length,
    timeline: playbackTimeline,
  }
}
