import * as THREE from 'three'
import type { CommitData, BossTier } from '../data/types'
import { createTextSprite } from './TextSprite'

export type MovementPattern = 'STRAIGHT' | 'ZIGZAG' | 'CIRCLE' | 'CHARGE'

// Color per commit type
const COMMIT_TYPE_COLORS: Record<string, string> = {
  bug: '#ff4444',
  feature: '#ff8800',
  refactor: '#ffff00',
  merge: '#ff00ff',
  chore: '#888888',
  docs: '#44aaff',
  style: '#44ffaa',
  test: '#aaaaff',
}

// Tier configuration
const TIER_CONFIG: Record<BossTier, {
  fontSize: number
  speed: number
  hp: number
  scale: number
  borderColor: string | null
  glowColor: number | null
}> = {
  MINI: {
    fontSize: 22,
    speed: 5,
    hp: 1,
    scale: 0.6,
    borderColor: null,
    glowColor: null,
  },
  NORMAL: {
    fontSize: 34,
    speed: 3,
    hp: 2,  // base; actual hp set from data
    scale: 1.0,
    borderColor: null,
    glowColor: null,
  },
  ELITE: {
    fontSize: 44,
    speed: 1.6,
    hp: 4,
    scale: 1.4,
    borderColor: '#ff2222',
    glowColor: 0xff1111,
  },
  MEGA: {
    fontSize: 54,
    speed: 0.9,
    hp: 8,
    scale: 1.9,
    borderColor: '#ff00ff',
    glowColor: 0xcc00cc,
  },
}

function pickMovementPattern(tier: BossTier): MovementPattern {
  const roll = Math.random()
  if (tier === 'MINI') return Math.random() < 0.5 ? 'STRAIGHT' : 'ZIGZAG'
  if (tier === 'MEGA') return 'CHARGE'
  if (roll < 0.25) return 'STRAIGHT'
  if (roll < 0.5) return 'ZIGZAG'
  if (roll < 0.75) return 'CIRCLE'
  return 'CHARGE'
}

export class Boss {
  group: THREE.Group
  data: CommitData
  tier: BossTier
  hp: number
  maxHp: number
  alive = true
  speed: number

  private movementPattern: MovementPattern
  private mainSprite!: THREE.Sprite
  private subSprite: THREE.Sprite | null = null
  private borderSprites: THREE.Sprite[] = []
  private branchSprites: THREE.Sprite[] = []
  private hitFlashTimer = 0
  private wobbleTime = 0
  private baseColor: number
  private chargeState: 'approach' | 'charging' = 'approach'
  private chargeTimer = 0
  private circleAngle = 0
  private circleRadius = 15
  private zigzagPhase = Math.random() * Math.PI * 2
  private pulseTime = 0
  private glowSprite: THREE.Sprite | null = null

  constructor(data: CommitData, spawnPos: THREE.Vector3, tier: BossTier) {
    this.data = data
    this.tier = tier
    this.group = new THREE.Group()
    this.group.position.copy(spawnPos)

    const cfg = TIER_CONFIG[tier]
    this.movementPattern = pickMovementPattern(tier)

    // HP
    if (tier === 'MINI') {
      this.maxHp = 1
    } else if (tier === 'NORMAL') {
      this.maxHp = 2 + Math.floor(Math.random() * 2) // 2-3
    } else if (tier === 'ELITE') {
      this.maxHp = 4 + Math.floor(Math.random() * 2) // 4-5
    } else {
      this.maxHp = 8 + Math.floor(data.files.length / 3)
    }
    this.hp = this.maxHp

    this.speed = cfg.speed + Math.random() * 0.5

    // Base color from commit type
    const colorStr = COMMIT_TYPE_COLORS[data.type] ?? '#ff4444'
    this.baseColor = parseInt(colorStr.replace('#', ''), 16)

    // --- Build visuals ---
    this.buildSprites(data, cfg, colorStr)

    // HP bar
    const hpBarBg = this.createHpBar(0x330000, cfg.scale)
    hpBarBg.position.set(0, cfg.scale * 1.8, 0)
    hpBarBg.name = 'hpBarBg'
    this.group.add(hpBarBg)

    const hpBarFill = this.createHpBar(this.baseColor, cfg.scale)
    hpBarFill.position.set(0, cfg.scale * 1.8, 0.01)
    hpBarFill.name = 'hpBarFill'
    this.group.add(hpBarFill)
  }

  private buildSprites(data: CommitData, cfg: typeof TIER_CONFIG[BossTier], colorStr: string) {
    const msgText = data.message.length > 45 ? data.message.slice(0, 45) + '...' : data.message

    if (this.tier === 'MINI') {
      // Just the message, small
      this.mainSprite = createTextSprite({
        text: msgText,
        fontSize: cfg.fontSize,
        color: colorStr,
        bold: true,
      })
      this.mainSprite.scale.multiplyScalar(cfg.scale)
      this.group.add(this.mainSprite)

    } else if (this.tier === 'NORMAL') {
      // Message + author/sha below
      this.mainSprite = createTextSprite({
        text: msgText,
        fontSize: cfg.fontSize,
        color: colorStr,
        bold: true,
      })
      this.mainSprite.scale.multiplyScalar(cfg.scale)
      this.group.add(this.mainSprite)

      this.subSprite = createTextSprite({
        text: `${data.author} | ${data.shortSha}`,
        fontSize: 22,
        color: '#ffcc88',
      })
      this.subSprite.position.set(0, -1.4, 0)
      this.subSprite.scale.multiplyScalar(cfg.scale * 0.55)
      this.group.add(this.subSprite)

    } else if (this.tier === 'ELITE') {
      // Message + author/sha + glowing border sprites
      this.mainSprite = createTextSprite({
        text: msgText,
        fontSize: cfg.fontSize,
        color: colorStr,
        bold: true,
      })
      this.mainSprite.scale.multiplyScalar(cfg.scale)
      this.group.add(this.mainSprite)

      this.subSprite = createTextSprite({
        text: `${data.author} | ${data.shortSha}`,
        fontSize: 22,
        color: '#ffaa44',
      })
      this.subSprite.position.set(0, -1.8, 0)
      this.subSprite.scale.multiplyScalar(cfg.scale * 0.5)
      this.group.add(this.subSprite)

      // Glowing border: 4 offset copies of the message in a dim red
      const offsets = [[-0.12, 0], [0.12, 0], [0, 0.12], [0, -0.12]]
      for (const [ox, oy] of offsets) {
        const borderSpr = createTextSprite({
          text: msgText,
          fontSize: cfg.fontSize,
          color: '#ff0000',
          bold: true,
        })
        borderSpr.scale.multiplyScalar(cfg.scale);
        (borderSpr.material as THREE.SpriteMaterial).opacity = 0.35
        borderSpr.position.set(ox, oy, -0.05)
        this.group.add(borderSpr)
        this.borderSprites.push(borderSpr)
      }

    } else {
      // MEGA: main merge message + two branch texts converging
      this.mainSprite = createTextSprite({
        text: msgText,
        fontSize: cfg.fontSize,
        color: '#ff00ff',
        bold: true,
      })
      this.mainSprite.scale.multiplyScalar(cfg.scale)
      this.group.add(this.mainSprite)

      this.subSprite = createTextSprite({
        text: `MERGE | ${data.shortSha}`,
        fontSize: 24,
        color: '#dd88ff',
      })
      this.subSprite.position.set(0, -2.2, 0)
      this.subSprite.scale.multiplyScalar(cfg.scale * 0.5)
      this.group.add(this.subSprite)

      // Two "branch" converging texts — extract from merge message if possible
      const mergeMatch = data.message.match(/Merge (?:branch |pull request )?['"]?(\S+?)['"]?(?: into (\S+))?/i)
      const branchA = mergeMatch?.[2] ?? 'main'
      const branchB = mergeMatch?.[1] ?? 'feature'
      const sprA = createTextSprite({ text: `<< ${branchA}`, fontSize: 20, color: '#ff88ff' })
      sprA.position.set(-3, 1.5, 0)
      sprA.scale.multiplyScalar(0.7)
      this.group.add(sprA)
      this.branchSprites.push(sprA)

      const sprB = createTextSprite({ text: `${branchB} >>`, fontSize: 20, color: '#ff88ff' })
      sprB.position.set(3, 1.5, 0)
      sprB.scale.multiplyScalar(0.7)
      this.group.add(sprB)
      this.branchSprites.push(sprB)

      // Pulsing glow: a large semi-transparent plane
      const glowGeo = new THREE.PlaneGeometry(cfg.scale * 5, cfg.scale * 3)
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xaa00aa,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      const glowMesh = new THREE.Mesh(glowGeo, glowMat)
      glowMesh.name = 'glowMesh'
      glowMesh.position.set(0, 0, -0.1)
      this.group.add(glowMesh)
    }
  }

  private createHpBar(color: number, tierScale: number): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(4 * tierScale, 0.3 * tierScale)
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    return new THREE.Mesh(geo, mat)
  }

  hit(damage = 1) {
    this.hp -= damage
    this.hitFlashTimer = 0.2

    const hpBarFill = this.group.getObjectByName('hpBarFill') as THREE.Mesh
    if (hpBarFill) {
      const ratio = Math.max(0, this.hp / this.maxHp)
      hpBarFill.scale.x = ratio
    }

    if (this.hp <= 0) {
      this.alive = false
    }
  }

  update(delta: number, cameraPos: THREE.Vector3) {
    if (!this.alive) return

    this.wobbleTime += delta * 2.5
    this.pulseTime += delta

    // Movement
    this.applyMovement(delta, cameraPos)

    // Vertical hover
    const cfg = TIER_CONFIG[this.tier]
    if (!this.group.userData.baseY) this.group.userData.baseY = this.group.position.y
    this.group.position.y = (this.group.userData.baseY as number) + Math.sin(this.wobbleTime) * 0.4

    // Scale pulsing on main sprite
    const pulseMag = this.tier === 'MEGA' ? 0.08 : 0.04
    const pulse = 1 + Math.sin(this.wobbleTime * 2) * pulseMag
    const baseScale = cfg.scale
    this.mainSprite.scale.set(
      this.mainSprite.scale.x > 0 ? (baseScale * pulse) : baseScale,
      this.mainSprite.scale.y > 0 ? (baseScale * pulse) : baseScale,
      1,
    )

    // MEGA branch sprites converge
    if (this.tier === 'MEGA' && this.branchSprites.length === 2) {
      const convergence = Math.sin(this.pulseTime * 0.8) * 0.5
      this.branchSprites[0].position.x = -3 + convergence
      this.branchSprites[1].position.x = 3 - convergence

      const glowMesh = this.group.getObjectByName('glowMesh') as THREE.Mesh | undefined
      if (glowMesh) {
        const glowPulse = 0.1 + Math.sin(this.pulseTime * 1.5) * 0.07
        ;(glowMesh.material as THREE.MeshBasicMaterial).opacity = glowPulse
      }
    }

    // ELITE border glow pulse
    if (this.tier === 'ELITE' && this.borderSprites.length > 0) {
      const auraOpacity = 0.25 + Math.sin(this.pulseTime * 3) * 0.15
      for (const spr of this.borderSprites) {
        ;(spr.material as THREE.SpriteMaterial).opacity = auraOpacity
      }
    }

    // Hit flash
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta
      const flash = Math.sin(this.hitFlashTimer * 40) > 0
      ;(this.mainSprite.material as THREE.SpriteMaterial).color.setHex(
        flash ? 0xffffff : this.baseColor
      )
    } else {
      ;(this.mainSprite.material as THREE.SpriteMaterial).color.setHex(this.baseColor)
    }
  }

  private applyMovement(delta: number, cameraPos: THREE.Vector3) {
    const pos = this.group.position

    if (this.movementPattern === 'STRAIGHT') {
      const dir = new THREE.Vector3().subVectors(cameraPos, pos)
      dir.y = 0
      dir.normalize()
      pos.addScaledVector(dir, this.speed * delta)

    } else if (this.movementPattern === 'ZIGZAG') {
      this.zigzagPhase += delta * 2.5
      const dir = new THREE.Vector3().subVectors(cameraPos, pos)
      dir.y = 0
      dir.normalize()
      // Perpendicular to direction
      const perp = new THREE.Vector3(-dir.z, 0, dir.x)
      pos.addScaledVector(dir, this.speed * delta)
      pos.addScaledVector(perp, Math.sin(this.zigzagPhase) * this.speed * 0.8 * delta)

    } else if (this.movementPattern === 'CIRCLE') {
      const dist = pos.distanceTo(cameraPos)
      // Close in slowly while circling
      this.circleAngle += delta * (1.2 / Math.max(1, dist * 0.1))
      if (dist > this.circleRadius) {
        const dir = new THREE.Vector3().subVectors(cameraPos, pos)
        dir.y = 0
        dir.normalize()
        pos.addScaledVector(dir, this.speed * 0.5 * delta)
      }
      // Circle offset around current position toward camera
      const tangent = new THREE.Vector3(Math.cos(this.circleAngle), 0, Math.sin(this.circleAngle))
      pos.addScaledVector(tangent, this.speed * 0.6 * delta)
      // Slowly shrink circle radius
      this.circleRadius = Math.max(4, this.circleRadius - delta * 0.3)

    } else if (this.movementPattern === 'CHARGE') {
      const dist = pos.distanceTo(cameraPos)
      if (this.chargeState === 'approach') {
        const dir = new THREE.Vector3().subVectors(cameraPos, pos)
        dir.y = 0
        dir.normalize()
        pos.addScaledVector(dir, this.speed * 0.4 * delta)
        if (dist < 20) {
          this.chargeState = 'charging'
          this.chargeTimer = 0.8
        }
      } else {
        // Charging burst
        if (this.chargeTimer > 0) {
          const dir = new THREE.Vector3().subVectors(cameraPos, pos)
          dir.y = 0
          dir.normalize()
          pos.addScaledVector(dir, this.speed * 4 * delta)
          this.chargeTimer -= delta
        } else {
          this.chargeState = 'approach'
        }
      }
    }
  }

  getPosition(): THREE.Vector3 {
    return this.group.position.clone()
  }

  getBoundingRadius(): number {
    const radii: Record<BossTier, number> = { MINI: 1.5, NORMAL: 2.5, ELITE: 3.5, MEGA: 5 }
    return radii[this.tier]
  }

  dispose() {
    this.group.traverse(child => {
      if (child instanceof THREE.Sprite) {
        child.material.map?.dispose()
        child.material.dispose()
      }
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        ;(child.material as THREE.Material).dispose()
      }
    })
  }
}
