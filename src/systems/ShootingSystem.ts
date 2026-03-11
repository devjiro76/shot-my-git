import * as THREE from 'three'
import type { CommitData } from '../data/types'
import { Bullet } from '../entities/Bullet'
import { Boss } from '../entities/Boss'

export class ShootingSystem {
  private codeCommits: CommitData[]
  private currentIndex = 0
  private bullets: Bullet[] = []
  private cooldown = 0
  private cooldownTime = 0.15

  constructor(codeCommits: CommitData[]) {
    this.codeCommits = codeCommits
  }

  get ammoCount(): number {
    return this.codeCommits.length
  }

  get currentAmmoData(): CommitData | null {
    return this.codeCommits[this.currentIndex % this.codeCommits.length]
  }

  shoot(position: THREE.Vector3, direction: THREE.Vector3, scene: THREE.Scene): Bullet | null {
    if (this.cooldown > 0) return null
    if (this.codeCommits.length === 0) return null

    const data = this.codeCommits[this.currentIndex++ % this.codeCommits.length]
    const bullet = new Bullet(data, position, direction)
    bullet.attachToScene(scene)
    this.bullets.push(bullet)
    scene.add(bullet.group)
    this.cooldown = this.cooldownTime

    return bullet
  }

  update(delta: number, bosses: Boss[], scene: THREE.Scene): { boss: Boss; bullet: Bullet } | null {
    this.cooldown -= delta
    let hitResult: { boss: Boss; bullet: Bullet } | null = null

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i]
      bullet.update(delta)

      if (!bullet.alive) {
        scene.remove(bullet.group)
        bullet.dispose()
        this.bullets.splice(i, 1)
        continue
      }

      // Collision detection with bosses
      const bulletPos = bullet.getPosition()
      for (const boss of bosses) {
        if (!boss.alive) continue
        const dist = bulletPos.distanceTo(boss.getPosition())
        if (dist < boss.getBoundingRadius()) {
          boss.hit()
          bullet.alive = false
          scene.remove(bullet.group)
          bullet.dispose()
          this.bullets.splice(i, 1)

          if (!boss.alive) {
            hitResult = { boss, bullet }
          }
          break
        }
      }
    }

    return hitResult
  }

  dispose(scene: THREE.Scene) {
    for (const bullet of this.bullets) {
      scene.remove(bullet.group)
      bullet.dispose()
    }
    this.bullets = []
  }
}
