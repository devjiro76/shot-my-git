import * as THREE from 'three'
import type { GitEvent } from '../data/types'
import { createTextSprite } from '../entities/TextSprite'

interface AnimatedSprite {
  sprite: THREE.Sprite
  velocity: THREE.Vector3
  life: number
  maxLife: number
  type: string
  phase: number // for multi-phase animations
}

export class GitEvents {
  private scene: THREE.Scene
  private sprites: AnimatedSprite[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  triggerRandom(events: GitEvent[], branches: string[], tags: string[]) {
    const roll = Math.random()

    if (tags.length > 0 && roll < 0.25) {
      const tag = tags[Math.floor(Math.random() * tags.length)]
      this.triggerTag(tag)
    } else if (branches.length > 1 && roll < 0.5) {
      const i = Math.floor(Math.random() * branches.length)
      let j = Math.floor(Math.random() * branches.length)
      if (j === i) j = (j + 1) % branches.length
      this.triggerMerge(branches[i], branches[j])
    } else if (branches.length > 0 && roll < 0.75) {
      const branch = branches[Math.floor(Math.random() * branches.length)]
      this.triggerBranch(branch)
    } else {
      this.triggerStash('git stash pop')
    }
  }

  triggerMerge(branchA: string, branchB: string) {
    // Two branch names fly from left and right, collide in center
    const nameA = branchA.split('/').pop() || branchA
    const nameB = branchB.split('/').pop() || branchB

    const spriteA = createTextSprite({
      text: `← ${nameA}`,
      fontSize: 32,
      color: '#ff00ff',
      bold: true,
    })
    spriteA.position.set(-40, 8 + Math.random() * 6, -20 - Math.random() * 20)
    spriteA.scale.multiplyScalar(0.8)
    this.scene.add(spriteA)

    const spriteB = createTextSprite({
      text: `${nameB} →`,
      fontSize: 32,
      color: '#ff44ff',
      bold: true,
    })
    spriteB.position.set(40, 8 + Math.random() * 6, -20 - Math.random() * 20)
    spriteB.scale.multiplyScalar(0.8)
    this.scene.add(spriteB)

    // Merge result text (hidden initially)
    const merged = createTextSprite({
      text: `MERGE: ${nameA} ⟶ ${nameB}`,
      fontSize: 36,
      color: '#ff88ff',
      bold: true,
    })
    merged.position.set(0, spriteA.position.y, spriteA.position.z)
    merged.material.opacity = 0
    this.scene.add(merged)

    this.sprites.push(
      {
        sprite: spriteA,
        velocity: new THREE.Vector3(18, 0, 0),
        life: 3, maxLife: 3,
        type: 'merge-left', phase: 0,
      },
      {
        sprite: spriteB,
        velocity: new THREE.Vector3(-18, 0, 0),
        life: 3, maxLife: 3,
        type: 'merge-right', phase: 0,
      },
      {
        sprite: merged,
        velocity: new THREE.Vector3(0, 1, 0),
        life: 4, maxLife: 4,
        type: 'merge-result', phase: 0,
      },
    )
  }

  triggerBranch(branchName: string) {
    const name = branchName.split('/').pop() || branchName

    // Main branch text
    const main = createTextSprite({
      text: `⎇ ${name}`,
      fontSize: 28,
      color: '#44ffaa',
      bold: true,
    })
    const startY = 6 + Math.random() * 8
    const startZ = -15 - Math.random() * 25
    main.position.set(0, startY, startZ)
    this.scene.add(main)

    // Fork into two paths
    const forkA = createTextSprite({
      text: name,
      fontSize: 22,
      color: '#22dd88',
    })
    forkA.position.copy(main.position)
    forkA.material.opacity = 0
    forkA.scale.multiplyScalar(0.6)
    this.scene.add(forkA)

    const forkB = createTextSprite({
      text: name,
      fontSize: 22,
      color: '#88ffcc',
    })
    forkB.position.copy(main.position)
    forkB.material.opacity = 0
    forkB.scale.multiplyScalar(0.6)
    this.scene.add(forkB)

    this.sprites.push(
      {
        sprite: main,
        velocity: new THREE.Vector3(0, 0, -5),
        life: 2, maxLife: 2,
        type: 'branch-main', phase: 0,
      },
      {
        sprite: forkA,
        velocity: new THREE.Vector3(-8, 2, -3),
        life: 3, maxLife: 3,
        type: 'branch-fork', phase: 0,
      },
      {
        sprite: forkB,
        velocity: new THREE.Vector3(8, -1, -3),
        life: 3, maxLife: 3,
        type: 'branch-fork', phase: 0,
      },
    )
  }

  triggerTag(tagName: string) {
    // Big version number drops from sky, pauses, fades
    const sprite = createTextSprite({
      text: `🏷 ${tagName}`,
      fontSize: 42,
      color: '#ffd700',
      bold: true,
    })
    sprite.position.set(
      (Math.random() - 0.5) * 20,
      30,
      -15 - Math.random() * 20,
    )
    sprite.scale.multiplyScalar(1.2)
    this.scene.add(sprite)

    // Glow
    const glow = new THREE.PointLight(0xffd700, 3, 20)
    glow.position.copy(sprite.position)
    glow.name = `tag-glow-${Date.now()}`
    this.scene.add(glow)

    this.sprites.push({
      sprite,
      velocity: new THREE.Vector3(0, -8, 0),
      life: 4, maxLife: 4,
      type: 'tag', phase: 0,
    })
  }

  triggerStash(message: string) {
    // Ghost-like text that appears and dissolves
    const sprite = createTextSprite({
      text: `📦 stash: ${message}`,
      fontSize: 26,
      color: '#ffffff',
    })
    sprite.position.set(
      (Math.random() - 0.5) * 30,
      5 + Math.random() * 8,
      -10 - Math.random() * 20,
    )
    sprite.material.opacity = 0
    this.scene.add(sprite)

    this.sprites.push({
      sprite,
      velocity: new THREE.Vector3(0, 2, 0),
      life: 3, maxLife: 3,
      type: 'stash', phase: 0,
    })
  }

  update(delta: number) {
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const s = this.sprites[i]
      s.life -= delta
      const t = 1 - s.life / s.maxLife // 0→1 progress

      if (s.life <= 0) {
        this.scene.remove(s.sprite)
        s.sprite.material.map?.dispose()
        s.sprite.material.dispose()
        // Clean up tag glow if present
        if (s.type === 'tag') {
          const glow = this.scene.children.find(
            c => c instanceof THREE.PointLight && c.name.startsWith('tag-glow-')
          )
          if (glow) this.scene.remove(glow)
        }
        this.sprites.splice(i, 1)
        continue
      }

      switch (s.type) {
        case 'merge-left':
        case 'merge-right':
          // Move toward center, then stop
          if (t < 0.5) {
            s.sprite.position.addScaledVector(s.velocity, delta)
          }
          s.sprite.material.opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3
          break

        case 'merge-result':
          // Appear after collision, float up
          if (t < 0.5) {
            s.sprite.material.opacity = 0
          } else {
            s.sprite.material.opacity = Math.min(1, (t - 0.5) * 4)
            s.sprite.position.addScaledVector(s.velocity, delta)
            // Pulse scale
            const pulse = 1 + Math.sin(t * 20) * 0.1
            s.sprite.scale.setScalar(pulse * 1.2)
          }
          if (t > 0.8) {
            s.sprite.material.opacity = 1 - (t - 0.8) / 0.2
          }
          break

        case 'branch-main':
          s.sprite.position.addScaledVector(s.velocity, delta)
          // Fade out midway
          s.sprite.material.opacity = t < 0.5 ? 1 : 1 - (t - 0.5) * 2
          break

        case 'branch-fork':
          // Appear after main fades, diverge
          if (t < 0.3) {
            s.sprite.material.opacity = t / 0.3
          } else {
            s.sprite.material.opacity = 1 - (t - 0.3) / 0.7
          }
          s.sprite.position.addScaledVector(s.velocity, delta)
          break

        case 'tag':
          // Drop fast, pause at y~10, then fade
          if (t < 0.3) {
            s.sprite.position.addScaledVector(s.velocity, delta)
          } else if (t < 0.7) {
            // Hover and pulse
            const tagPulse = 1 + Math.sin(t * 30) * 0.08
            s.sprite.scale.setScalar(tagPulse * 1.2)
            s.sprite.material.opacity = 1
          } else {
            s.sprite.material.opacity = 1 - (t - 0.7) / 0.3
            s.sprite.position.y += delta * 3
          }
          break

        case 'stash':
          // Fade in, float up, dissolve
          if (t < 0.2) {
            s.sprite.material.opacity = t / 0.2 * 0.6
          } else if (t < 0.5) {
            s.sprite.material.opacity = 0.6
          } else {
            s.sprite.material.opacity = 0.6 * (1 - (t - 0.5) / 0.5)
          }
          s.sprite.position.addScaledVector(s.velocity, delta)
          // Ghostly wobble
          s.sprite.position.x += Math.sin(t * 15) * 0.05
          break
      }
    }
  }
}
