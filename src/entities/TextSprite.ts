import * as THREE from 'three'

interface TextSpriteOptions {
  text: string
  fontSize?: number
  color?: string
  backgroundColor?: string
  maxWidth?: number
  fontFamily?: string
  bold?: boolean
}

export function createTextSprite(opts: TextSpriteOptions): THREE.Sprite {
  const {
    text,
    fontSize = 48,
    color = '#00ff41',
    backgroundColor = 'transparent',
    maxWidth = 1024,
    fontFamily = '"Press Start 2P", "Courier New", monospace',
    bold = false,
  } = opts

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  const weight = bold ? 'bold ' : ''
  ctx.font = `${weight}${fontSize}px ${fontFamily}`
  const metrics = ctx.measureText(text)
  const textWidth = Math.min(metrics.width + 20, maxWidth)
  const textHeight = fontSize * 1.4

  canvas.width = nextPow2(textWidth)
  canvas.height = nextPow2(textHeight)

  if (backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  ctx.font = `${weight}${fontSize}px ${fontFamily}`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2, maxWidth - 20)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter

  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  })

  const sprite = new THREE.Sprite(spriteMat)
  const aspect = canvas.width / canvas.height
  sprite.scale.set(aspect * 2, 2, 1)

  return sprite
}

export function createMultiLineSprite(lines: string[], opts: Omit<TextSpriteOptions, 'text'>): THREE.Sprite {
  const {
    fontSize = 32,
    color = '#00ff41',
    fontFamily = '"Press Start 2P", "Courier New", monospace',
  } = opts

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  ctx.font = `${fontSize}px ${fontFamily}`
  const lineHeight = fontSize * 1.5
  const maxW = Math.max(...lines.map(l => ctx.measureText(l).width)) + 20
  const totalH = lineHeight * lines.length + 10

  canvas.width = nextPow2(Math.min(maxW, 1024))
  canvas.height = nextPow2(totalH)

  ctx.font = `${fontSize}px ${fontFamily}`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'

  lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width / 2, 5 + i * lineHeight, 1004)
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter

  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  })

  const sprite = new THREE.Sprite(spriteMat)
  const aspect = canvas.width / canvas.height
  const scale = lines.length * 1.2
  sprite.scale.set(aspect * scale, scale, 1)

  return sprite
}

function nextPow2(v: number): number {
  let p = 1
  while (p < v) p <<= 1
  return p
}
