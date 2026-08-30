const canvas = document.querySelector('canvas[data-cordisx-animation="one-shot"]')

if (canvas instanceof HTMLCanvasElement) {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

  const loadOfficialArtwork = async () => {
    const response = await fetch('./cordisx-mark-animated-dark.svg')
    if (!response.ok) throw new Error(`CordisX artwork returned HTTP ${response.status}`)
    const source = await response.text()
    const outerMatch = source.match(/const outer = (\[.*?\]);/)
    const officialMatch = source.match(/const official = (\[.*?\]);/)
    if (outerMatch === null || officialMatch === null) {
      throw new Error('CordisX artwork has an unexpected structure')
    }
    const outer = JSON.parse(outerMatch[1])
    const official = JSON.parse(officialMatch[1])
    if (outer.length !== 480 || official.length !== 1440) {
      throw new Error('CordisX artwork has an unexpected line count')
    }
    return { official, outer }
  }

  const animate = async () => {
    const { official, outer } = await loadOfficialArtwork()
    const context = canvas.getContext('2d')
    if (context === null) return

    canvas.classList.add('is-animated')
    const center = 512
    const baseWidth = 56
    const hold = 420
    const finish = 3200
    const targetTilt = 64.8 * Math.PI / 180
    const artworkBounds = outer.reduce((bounds, line) => {
      const radius = line[4] / 2
      return {
        minX: Math.min(bounds.minX, line[0] - radius, line[2] - radius),
        minY: Math.min(bounds.minY, line[1] - radius, line[3] - radius),
        maxX: Math.max(bounds.maxX, line[0] + radius, line[2] + radius),
        maxY: Math.max(bounds.maxY, line[1] + radius, line[3] + radius),
      }
    }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
    const artworkWidth = artworkBounds.maxX - artworkBounds.minX
    const artworkHeight = artworkBounds.maxY - artworkBounds.minY
    const renderScale = Math.min(canvas.width / artworkWidth, canvas.height / artworkHeight)
    const renderOffsetX = (canvas.width / renderScale - artworkWidth) / 2 - artworkBounds.minX
    const renderOffsetY = (canvas.height / renderScale - artworkHeight) / 2 - artworkBounds.minY
    const configs = [
      { axis: null, direction: 0, distance: Infinity },
      { axis: 45 * Math.PI / 180, direction: -1, distance: 4200 },
      { axis: 135 * Math.PI / 180, direction: 1, distance: 4200 },
    ]
    const ease = progress => -(Math.cos(Math.PI * progress) - 1) / 2
    const hex = value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')
    const shade = width => {
      const middle = clamp(188 + (width - baseWidth) * 15.4, 125, 252)
      return `#${hex(middle - 2)}${hex(middle)}${hex(middle + 2)}`
    }
    const rotate = (point, axisAngle, angle) => {
      const ux = Math.cos(axisAngle)
      const uy = Math.sin(axisAngle)
      const cosine = Math.cos(angle)
      const sine = Math.sin(angle)
      const dot = ux * point.x + uy * point.y
      return {
        x: point.x * cosine + uy * point.z * sine + ux * dot * (1 - cosine),
        y: point.y * cosine - ux * point.z * sine + uy * dot * (1 - cosine),
        z: (ux * point.y - uy * point.x) * sine + point.z * cosine,
      }
    }
    const project = (point, distance) => {
      const scale = distance / (distance - point.z)
      return { x: center + point.x * scale, y: center + point.y * scale, z: point.z }
    }
    const draw = lines => {
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.save()
      context.scale(renderScale, renderScale)
      context.translate(renderOffsetX, renderOffsetY)
      context.lineCap = 'round'
      for (const line of lines) {
        context.beginPath()
        context.moveTo(line[0], line[1])
        context.lineTo(line[2], line[3])
        context.lineWidth = line[4]
        context.strokeStyle = line[5]
        context.stroke()
      }
      context.restore()
    }
    const renderOfficial = () => draw(official)

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      renderOfficial()
      return
    }

    const start = performance.now()
    const frame = now => {
      const elapsed = now - start
      const progress = elapsed <= hold ? 0 : ease(clamp((elapsed - hold) / (finish - hold), 0, 1))
      const rendered = []

      configs.forEach((config, ringIndex) => {
        const angle = config.direction * (Math.PI * 2 + targetTilt) * progress
        outer.forEach(source => {
          if (ringIndex === 0 || config.axis === null) {
            rendered.push({ line: source, depth: 0 })
            return
          }
          const first3d = rotate({ x: source[0] - center, y: source[1] - center, z: 0 }, config.axis, angle)
          const second3d = rotate({ x: source[2] - center, y: source[3] - center, z: 0 }, config.axis, angle)
          const first = project(first3d, config.distance)
          const second = project(second3d, config.distance)
          const depth = (first.z + second.z) / 2
          const scale = config.distance / (config.distance - depth)
          const width = baseWidth * scale
          rendered.push({ line: [first.x, first.y, second.x, second.y, width, shade(width)], depth })
        })
      })

      rendered.sort((left, right) => left.depth - right.depth)
      draw(rendered.map(item => item.line))
      if (elapsed < finish) window.requestAnimationFrame(frame)
      else renderOfficial()
    }
    window.requestAnimationFrame(frame)
  }

  animate().catch(error => {
    console.error('CordisX brand animation failed', error)
  })
}
