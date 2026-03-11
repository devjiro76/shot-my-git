import * as THREE from 'three'
import type { CommitData } from '../data/types'
import { createTextSprite } from './TextSprite'

interface GhostSprite {
  sprite: THREE.Sprite
  life: number
  maxLife: number
}

const COMMIT_TYPE_COLORS: Record<string, string> = {
  feature: '#00ff41',
  bug: '#ff4444',
  refactor: '#aaff44',
  merge: '#44ffaa',
  chore: '#88aa88',
  docs: '#44aaff',
  style: '#ffaa44',
  test: '#aa44ff',
}

const INTERESTING_KEYWORDS = /\b(function|class|interface|export|import|return|const|let|var|async|await|type|enum)\b/

export class Bullet {
  group: THREE.Group
  data: CommitData
  alive = true
  speed = 80
  lifetime = 3
  private age = 0
  private direction: THREE.Vector3
  private ghosts: GhostSprite[] = []
  private ghostSpawnTimer = 0
  private scene: THREE.Scene | null = null

  constructor(data: CommitData, position: THREE.Vector3, direction: THREE.Vector3) {
    this.data = data
    this.direction = direction.clone().normalize()
    this.group = new THREE.Group()
    this.group.position.copy(position)

    const commitType = data.type ?? 'chore'
    const bulletColor = COMMIT_TYPE_COLORS[commitType] ?? '#00ff41'

    // Code text as bullet
    const codeText = this.extractCodeSnippet(data)
    const codeSprite = createTextSprite({
      text: codeText,
      fontSize: 24,
      color: bulletColor,
      bold: true,
    })
    codeSprite.scale.multiplyScalar(0.5)
    this.group.add(codeSprite)

    // Diff stats below the code: +42 -13
    const insertions = data.insertions ?? 0
    const deletions = data.deletions ?? 0
    if (insertions > 0 || deletions > 0) {
      const statsText = `+${insertions} -${deletions}`
      const statsSprite = createTextSprite({
        text: statsText,
        fontSize: 18,
        color: '#00ff41',
      })
      statsSprite.position.set(0, -0.35, 0)
      statsSprite.scale.multiplyScalar(0.28)
      this.group.add(statsSprite)
    }

    // SHA trailing behind
    const shaSprite = createTextSprite({
      text: data.shortSha,
      fontSize: 18,
      color: '#00ffff',
    })
    shaSprite.position.set(0, -0.65, 0)
    shaSprite.scale.multiplyScalar(0.25)
    this.group.add(shaSprite)

    // Point light for glow effect
    const glowColor = new THREE.Color(bulletColor)
    const glow = new THREE.PointLight(glowColor, 1, 5)
    this.group.add(glow)
  }

  private extractCodeSnippet(data: CommitData): string {
    // Priority 1: codeConstructs
    const constructs = data.codeConstructs
    if (constructs && constructs.length > 0) {
      const pick = constructs[Math.floor(Math.random() * constructs.length)]
      return pick.length > 32 ? pick.slice(0, 32) + '...' : pick
    }

    // Priority 2: interesting diff lines
    if (data.diff) {
      const lines = data.diff.split('\n')
      // Find lines with interesting keywords
      const interesting = lines.find(l => {
        if (!l.startsWith('+') || l.startsWith('+++')) return false
        const code = l.slice(1).trim()
        return code.length > 3 && INTERESTING_KEYWORDS.test(code)
      })
      if (interesting) {
        const code = interesting.slice(1).trim()
        return code.length > 32 ? code.slice(0, 32) + '...' : code
      }
      // Fallback to any non-boring added line
      const anyLine = lines.find(l => {
        if (!l.startsWith('+') || l.startsWith('+++')) return false
        const code = l.slice(1).trim()
        return code.length > 3 && code !== '{' && code !== '}' && code !== ''
      })
      if (anyLine) {
        const code = anyLine.slice(1).trim()
        return code.length > 32 ? code.slice(0, 32) + '...' : code
      }
    }

    // Priority 3: stylized commit summary
    const author = data.author.split(' ')[0]
    const type = data.type ?? 'chore'
    const msg = data.message
    const summary = `${author}: ${type}: ${msg}`
    return summary.length > 32 ? summary.slice(0, 32) + '...' : summary
  }

  private spawnGhost() {
    if (!this.scene) return
    const codeText = this.extractCodeSnippet(this.data)
    const commitType = this.data.type ?? 'chore'
    const bulletColor = COMMIT_TYPE_COLORS[commitType] ?? '#00ff41'

    const ghost = createTextSprite({
      text: codeText,
      fontSize: 24,
      color: bulletColor,
      bold: true,
    })
    ghost.scale.multiplyScalar(0.5)
    ghost.position.copy(this.group.position)
    ghost.material.opacity = 0.5
    this.scene.add(ghost)

    this.ghosts.push({
      sprite: ghost,
      life: 0.25,
      maxLife: 0.25,
    })
  }

  attachToScene(scene: THREE.Scene) {
    this.scene = scene
  }

  update(delta: number): boolean {
    if (!this.alive) return false

    this.age += delta
    if (this.age > this.lifetime) {
      this.alive = false
      return false
    }

    // Move forward
    this.group.position.addScaledVector(this.direction, this.speed * delta)

    // Slight rotation for dynamism
    this.group.rotation.z += delta * 2

    // Spawn ghost trail sprites
    this.ghostSpawnTimer += delta
    if (this.ghostSpawnTimer > 0.04) {
      this.ghostSpawnTimer = 0
      // Spawn 2-3 ghosts at staggered positions behind the bullet
      const count = 2 + Math.floor(Math.random() * 2)
      for (let i = 0; i < count; i++) {
        this.spawnGhost()
      }
    }

    // Update ghost sprites
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i]
      g.life -= delta
      if (g.life <= 0) {
        if (this.scene) this.scene.remove(g.sprite)
        g.sprite.material.map?.dispose()
        g.sprite.material.dispose()
        this.ghosts.splice(i, 1)
        continue
      }
      // Fade out quickly
      g.sprite.material.opacity = Math.max(0, (g.life / g.maxLife) * 0.5)
    }

    return true
  }

  getPosition(): THREE.Vector3 {
    return this.group.position.clone()
  }

  dispose() {
    // Clean up ghosts
    for (const g of this.ghosts) {
      if (this.scene) this.scene.remove(g.sprite)
      g.sprite.material.map?.dispose()
      g.sprite.material.dispose()
    }
    this.ghosts = []

    this.group.traverse(child => {
      if (child instanceof THREE.Sprite) {
        child.material.map?.dispose()
        child.material.dispose()
      }
    })
  }
}
