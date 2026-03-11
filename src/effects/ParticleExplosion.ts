import * as THREE from 'three'
import type { CommitData } from '../data/types'
import { createTextSprite } from '../entities/TextSprite'

interface TextParticle {
  sprite: THREE.Sprite
  velocity: THREE.Vector3
  life: number
  maxLife: number
  gravity: number
}

export class ParticleExplosion {
  private particles: TextParticle[] = []
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  explode(position: THREE.Vector3, data: CommitData) {
    const fragments = this.generateFragments(data)

    for (const frag of fragments) {
      const sprite = createTextSprite({
        text: frag.text,
        fontSize: frag.fontSize,
        color: frag.color,
      })
      sprite.position.copy(position)
      sprite.scale.multiplyScalar(frag.scale)
      this.scene.add(sprite)

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        Math.random() * 10 + 3,
        (Math.random() - 0.5) * 15,
      )

      this.particles.push({
        sprite,
        velocity,
        life: 2 + Math.random(),
        maxLife: 2 + Math.random(),
        gravity: 8,
      })
    }
  }

  private generateFragments(data: CommitData) {
    const fragments: { text: string; color: string; fontSize: number; scale: number }[] = []

    // Author name (yellow)
    fragments.push({
      text: data.author,
      color: '#ffff00',
      fontSize: 28,
      scale: 0.4,
    })

    // SHA (cyan)
    fragments.push({
      text: data.sha.slice(0, 12),
      color: '#00ffff',
      fontSize: 24,
      scale: 0.3,
    })

    // Commit message words (red/orange)
    const words = data.message.split(/\s+/).slice(0, 6)
    for (const word of words) {
      if (word.length < 2) continue
      fragments.push({
        text: word,
        color: Math.random() > 0.5 ? '#ff4444' : '#ff8800',
        fontSize: 22,
        scale: 0.3,
      })
    }

    // Code diff fragments (green)
    if (data.diff) {
      const codeLines = data.diff.split('\n')
        .filter(l => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'))
        .slice(0, 4)
      for (const line of codeLines) {
        const code = line.slice(1).trim()
        if (code.length < 3) continue
        fragments.push({
          text: code.slice(0, 20),
          color: line.startsWith('+') ? '#00ff41' : '#ff3333',
          fontSize: 20,
          scale: 0.25,
        })
      }
    }

    // File names (purple)
    for (const file of data.files.slice(0, 3)) {
      const filename = file.split('/').pop() || file
      fragments.push({
        text: filename,
        color: '#cc66ff',
        fontSize: 20,
        scale: 0.25,
      })
    }

    return fragments
  }

  update(delta: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= delta

      if (p.life <= 0) {
        this.scene.remove(p.sprite)
        p.sprite.material.map?.dispose()
        p.sprite.material.dispose()
        this.particles.splice(i, 1)
        continue
      }

      // Physics
      p.velocity.y -= p.gravity * delta
      p.sprite.position.addScaledVector(p.velocity, delta)

      // Fade out
      const alpha = Math.max(0, p.life / p.maxLife)
      p.sprite.material.opacity = alpha

      // Slow rotation
      p.sprite.material.rotation += delta * 2
    }
  }

  get activeCount(): number {
    return this.particles.length
  }
}
