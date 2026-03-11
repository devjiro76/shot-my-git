import * as THREE from 'three'

interface RainColumn {
  mesh: THREE.Mesh
  speed: number
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  lines: string[]
  offset: number
}

export class CodeRain {
  private columns: RainColumn[] = []
  private scene: THREE.Scene
  private codeLines: string[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  init(diffTexts: string[]) {
    // Extract individual lines from all diffs
    this.codeLines = diffTexts
      .flatMap(d => d.split('\n'))
      .filter(l => l.trim().length > 2)

    if (this.codeLines.length === 0) {
      this.codeLines = ['const git = require("git")', 'function fix(bug) {', '  return solution', '}']
    }

    // Create rain columns spread across the background
    const columnCount = 20
    for (let i = 0; i < columnCount; i++) {
      this.createColumn(i, columnCount)
    }
  }

  private createColumn(index: number, total: number) {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 1024
    const ctx = canvas.getContext('2d')!

    const lines: string[] = []
    for (let j = 0; j < 20; j++) {
      lines.push(this.codeLines[Math.floor(Math.random() * this.codeLines.length)])
    }

    this.renderColumn(ctx, canvas, lines, 0)

    const texture = new THREE.CanvasTexture(canvas)
    texture.minFilter = THREE.NearestFilter
    texture.magFilter = THREE.NearestFilter

    const geo = new THREE.PlaneGeometry(5, 40)
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    const mesh = new THREE.Mesh(geo, mat)

    // Position in a circle around the player at far distance
    const angle = (index / total) * Math.PI * 2
    const radius = 60 + Math.random() * 30
    mesh.position.set(
      Math.cos(angle) * radius,
      20,
      Math.sin(angle) * radius,
    )
    mesh.lookAt(0, 20, 0)

    this.scene.add(mesh)

    this.columns.push({
      mesh,
      speed: 0.5 + Math.random() * 1.5,
      canvas,
      ctx,
      lines,
      offset: Math.random() * 100,
    })
  }

  private renderColumn(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, lines: string[], offset: number) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.font = '14px "Courier New", monospace'

    const lineHeight = 48
    for (let i = 0; i < lines.length; i++) {
      const y = ((i * lineHeight + offset * lineHeight) % (canvas.height + lineHeight)) - lineHeight
      const alpha = 0.3 + (y / canvas.height) * 0.7
      ctx.fillStyle = `rgba(0, 255, 65, ${alpha})`
      ctx.fillText(lines[i].slice(0, 30), 4, y)
    }
  }

  update(delta: number) {
    for (const col of this.columns) {
      col.offset += delta * col.speed
      this.renderColumn(col.ctx, col.canvas, col.lines, col.offset)
      const mat = col.mesh.material as THREE.MeshBasicMaterial
      if (mat.map) {
        mat.map.needsUpdate = true
      }
    }
  }
}
