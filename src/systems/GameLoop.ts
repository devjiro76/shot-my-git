import type { GitData, GameState } from '../data/types'
import { SceneManager } from '../scene/SceneManager'
import { Environment } from '../scene/Environment'
import { BossSpawner } from './BossSpawner'
import { ShootingSystem } from './ShootingSystem'
import { HUD } from './HUD'
import { ScreenShake } from '../effects/ScreenShake'
import { ParticleExplosion } from '../effects/ParticleExplosion'
import { CodeRain } from '../effects/CodeRain'
import { GitEvents } from '../effects/GitEvents'

export class GameLoop {
  private sceneManager: SceneManager
  private environment: Environment
  private bossSpawner: BossSpawner
  private shootingSystem: ShootingSystem
  private hud: HUD
  private screenShake: ScreenShake
  private particles: ParticleExplosion
  private codeRain: CodeRain
  private gitEvents: GitEvents

  private state: GameState = 'LOADING'
  private gitData: GitData
  private kills = 0
  private introTimer = 0
  private waveClearTimer = 0
  private gitEventTimer = 0
  private gitEventInterval = 8 // trigger a git event every ~8 seconds

  constructor(sceneManager: SceneManager, gitData: GitData) {
    this.sceneManager = sceneManager
    this.gitData = gitData

    this.environment = new Environment()
    this.environment.setup(sceneManager.scene)

    this.bossSpawner = new BossSpawner(gitData.bugCommits)
    this.shootingSystem = new ShootingSystem(gitData.codeCommits)

    this.hud = new HUD()
    this.hud.setRepo(gitData.repoName, gitData.totalCommits)
    this.hud.setAmmo(this.shootingSystem.ammoCount)

    this.screenShake = new ScreenShake()
    this.particles = new ParticleExplosion(sceneManager.scene)
    this.codeRain = new CodeRain(sceneManager.scene)
    this.codeRain.init(gitData.commits.map(c => c.diff).filter(Boolean))

    this.gitEvents = new GitEvents(sceneManager.scene)

    this.setupInput()
    this.setState('INTRO')
  }

  private setupInput() {
    document.addEventListener('click', () => {
      if (this.state === 'INTRO' || this.state === 'GAME_OVER') {
        this.sceneManager.lock()
        if (this.state === 'INTRO') {
          this.setState('PLAYING')
        } else {
          this.restart()
        }
        return
      }

      if (this.state === 'PLAYING') {
        this.fire()
      }
    })

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && this.state === 'PLAYING' && this.sceneManager.isLocked()) {
        e.preventDefault()
        this.fire()
      }
    })

    document.addEventListener('pointerlockchange', () => {
      if (!this.sceneManager.isLocked() && this.state === 'PLAYING') {
        this.hud.showCenterMessage('CLICK TO RESUME')
      }
    })
  }

  private fire() {
    const pos = this.sceneManager.getCameraPosition()
    const dir = this.sceneManager.getForwardDirection()
    pos.addScaledVector(dir, 1)

    const bullet = this.shootingSystem.shoot(pos, dir, this.sceneManager.scene)
    if (bullet) {
      this.screenShake.shake(0.05)
      this.hud.setAmmo(this.shootingSystem.ammoCount)
    }
  }

  private setState(state: GameState) {
    this.state = state

    switch (state) {
      case 'INTRO': {
        const bugCount = this.gitData.bugCommits.length
        const branchCount = this.gitData.branches?.length ?? 0
        const tagCount = this.gitData.tags?.length ?? 0
        const statsLine = [
          `${bugCount} BUGS`,
          branchCount > 0 ? `${branchCount} BRANCHES` : '',
          tagCount > 0 ? `${tagCount} TAGS` : '',
        ].filter(Boolean).join(' / ')
        this.hud.showCenterMessage(
          `SHOT MY GIT<br><br>${this.gitData.repoName}<br>${statsLine}<br><br>CLICK TO START`
        )
        this.hud.showCrosshair(false)
        break
      }

      case 'PLAYING':
        this.hud.hideCenterMessage()
        this.hud.showCrosshair(true)
        if (this.bossSpawner.currentWave === 0) {
          this.bossSpawner.startNextWave(this.sceneManager.getCameraPosition())
          this.hud.showWaveMessage(this.bossSpawner.currentWave)
        }
        break

      case 'WAVE_CLEAR':
        this.waveClearTimer = 3
        this.hud.showCenterMessage(`WAVE ${this.bossSpawner.currentWave} CLEAR!`)
        // Trigger a git event during wave clear for visual flair
        this.gitEvents.triggerRandom(
          this.gitData.events ?? [],
          this.gitData.branches ?? [],
          this.gitData.tags ?? [],
        )
        break

      case 'GAME_OVER':
        this.hud.showGameOver(this.kills, this.gitData.repoName)
        this.hud.showCrosshair(false)
        break
    }
  }

  private restart() {
    this.shootingSystem.dispose(this.sceneManager.scene)

    this.kills = 0
    this.gitEventTimer = 0
    this.bossSpawner = new BossSpawner(this.gitData.bugCommits)
    this.shootingSystem = new ShootingSystem(this.gitData.codeCommits)
    this.hud.setAmmo(this.shootingSystem.ammoCount)
    this.hud.setRepo(this.gitData.repoName, this.gitData.totalCommits)

    this.setState('PLAYING')
    this.bossSpawner.startNextWave(this.sceneManager.getCameraPosition())
    this.hud.showWaveMessage(this.bossSpawner.currentWave)
  }

  update() {
    const delta = this.sceneManager.clock.getDelta()

    // Always update visual effects
    this.codeRain.update(delta)
    this.particles.update(delta)
    this.gitEvents.update(delta)
    this.screenShake.update(delta, this.sceneManager.camera)
    this.hud.update(delta)
    this.environment.update(this.sceneManager.getCameraPosition())

    if (this.state === 'PLAYING') {
      if (this.sceneManager.isLocked()) {
        this.sceneManager.updateMovement(delta)
      }

      const cameraPos = this.sceneManager.getCameraPosition()

      // Periodic git events for visual dynamism
      this.gitEventTimer += delta
      if (this.gitEventTimer >= this.gitEventInterval) {
        this.gitEventTimer = 0
        this.gitEventInterval = 6 + Math.random() * 6 // vary interval 6-12s
        this.gitEvents.triggerRandom(
          this.gitData.events ?? [],
          this.gitData.branches ?? [],
          this.gitData.tags ?? [],
        )
      }

      // Update boss spawner (handles movement + cleanup)
      this.bossSpawner.update(delta, cameraPos, this.sceneManager.scene)

      // Update shooting system (handles bullets + kill detection)
      const hitResult = this.shootingSystem.update(delta, this.bossSpawner.activeBosses, this.sceneManager.scene)
      if (hitResult) {
        this.kills++
        this.hud.addKill()
        this.particles.explode(hitResult.boss.getPosition(), hitResult.boss.data)
        this.screenShake.shake(0.4)
      }

      // Update HUD boss info
      const closestBoss = this.bossSpawner.getClosestBoss(cameraPos)
      this.hud.setBossInfo(closestBoss?.data ?? null)

      // Check wave completion
      if (this.bossSpawner.isWaveComplete) {
        if (this.bossSpawner.allWavesComplete) {
          this.setState('GAME_OVER')
        } else {
          this.setState('WAVE_CLEAR')
        }
      }
    }

    if (this.state === 'WAVE_CLEAR') {
      this.waveClearTimer -= delta
      if (this.waveClearTimer <= 0) {
        this.bossSpawner.startNextWave(this.sceneManager.getCameraPosition())
        this.hud.showWaveMessage(this.bossSpawner.currentWave)
        this.setState('PLAYING')
      }
    }

    this.sceneManager.render()
  }
}
