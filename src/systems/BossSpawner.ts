import * as THREE from 'three'
import type { CommitData, BossTier } from '../data/types'
import { Boss } from '../entities/Boss'

type SpawnFormation = 'SCATTERED' | 'V_FORMATION' | 'LINE' | 'SINGLE'

interface PendingSpawn {
  data: CommitData
  tier: BossTier
  position: THREE.Vector3
  delay: number  // seconds remaining before actual spawn
}

export function determineTier(data: CommitData): BossTier {
  const insertions = data.insertions ?? 0
  const deletions = data.deletions ?? 0
  if (data.isMerge || data.files.length >= 10) return 'MEGA'
  if (data.files.length >= 6 || (insertions + deletions) >= 100) return 'ELITE'
  if (data.files.length >= 3) return 'NORMAL'
  return 'MINI'
}

function buildFormationPositions(
  formation: SpawnFormation,
  count: number,
  cameraPos: THREE.Vector3,
): THREE.Vector3[] {
  const positions: THREE.Vector3[] = []
  const baseZ = cameraPos.z - 30 - Math.random() * 30  // -30 to -60 in front

  switch (formation) {
    case 'SCATTERED': {
      for (let i = 0; i < count; i++) {
        positions.push(new THREE.Vector3(
          cameraPos.x + (Math.random() - 0.5) * 80,  // -40 to +40
          2 + Math.random() * 8,
          baseZ - Math.random() * 30,
        ))
      }
      break
    }
    case 'V_FORMATION': {
      // Center + arms spreading left and right
      const half = Math.floor(count / 2)
      for (let i = 0; i < count; i++) {
        const side = i - half
        positions.push(new THREE.Vector3(
          cameraPos.x + side * 8,
          4 + Math.abs(side) * 1.5,
          baseZ - Math.abs(side) * 6,
        ))
      }
      break
    }
    case 'LINE': {
      // Horizontal line spread across -40 to +40
      const spacing = Math.min(12, 80 / Math.max(count - 1, 1))
      const startX = cameraPos.x - (spacing * (count - 1)) / 2
      for (let i = 0; i < count; i++) {
        positions.push(new THREE.Vector3(
          startX + i * spacing,
          3 + Math.random() * 4,
          baseZ + (Math.random() - 0.5) * 10,
        ))
      }
      break
    }
    case 'SINGLE': {
      positions.push(new THREE.Vector3(
        cameraPos.x + (Math.random() - 0.5) * 10,
        5,
        baseZ,
      ))
      break
    }
  }

  return positions
}

function buildWaveGroup(
  waveNumber: number,
  commits: CommitData[],
): Array<{ data: CommitData; tier: BossTier }> {
  const group: Array<{ data: CommitData; tier: BossTier }> = []

  for (const data of commits) {
    const tier = determineTier(data)
    group.push({ data, tier })
  }

  // If wave has no commits already categorised, just use MINI
  return group
}

export class BossSpawner {
  private bugCommits: CommitData[]
  private currentIndex = 0
  private waveNumber = 0
  private spawnedInWave = 0
  private pendingSpawns: PendingSpawn[] = []

  // Track how many we expect to spawn this wave (for isWaveComplete)
  private waveTargetCount = 0

  activeBosses: Boss[] = []

  constructor(bugCommits: CommitData[]) {
    this.bugCommits = bugCommits
  }

  get totalBugs(): number {
    return this.bugCommits.length
  }

  get currentWave(): number {
    return this.waveNumber
  }

  get isWaveComplete(): boolean {
    return (
      this.pendingSpawns.length === 0 &&
      this.spawnedInWave >= this.waveTargetCount &&
      this.activeBosses.every(b => !b.alive)
    )
  }

  private maxWaves = 10

  get allWavesComplete(): boolean {
    return (
      this.waveNumber >= this.maxWaves &&
      this.pendingSpawns.length === 0 &&
      this.activeBosses.every(b => !b.alive)
    )
  }

  startNextWave(cameraPos: THREE.Vector3) {
    this.waveNumber++
    this.spawnedInWave = 0
    this.pendingSpawns = []

    // Decide wave composition and formation
    const { commits, formation } = this.selectWaveCommits()
    this.waveTargetCount = commits.length

    if (commits.length === 0) return

    const positions = buildFormationPositions(formation, commits.length, cameraPos)

    commits.forEach(({ data, tier }, i) => {
      this.pendingSpawns.push({
        data,
        tier,
        position: positions[i] ?? positions[0],
        delay: i * 0.5,  // 0.5s stagger between each spawn
      })
    })
  }

  private selectWaveCommits(): {
    commits: Array<{ data: CommitData; tier: BossTier }>
    formation: SpawnFormation
  } {
    // Cycle through commits using modulo so waves never run out
    const len = this.bugCommits.length
    if (len === 0) return { commits: [], formation: 'SCATTERED' }
    const startIdx = this.currentIndex % len
    const remaining = [
      ...this.bugCommits.slice(startIdx),
      ...this.bugCommits.slice(0, startIdx),
    ]

    const wave = this.waveNumber

    let formation: SpawnFormation
    let selected: CommitData[]

    if (wave <= 2) {
      // Waves 1-2: mostly MINI with 1-2 NORMAL. Take up to 5 commits.
      const count = Math.min(5, remaining.length)
      selected = remaining.slice(0, count)
      formation = 'SCATTERED'
    } else if (wave <= 4) {
      // Waves 3-4: mix of NORMAL and ELITE. Take up to 4 commits.
      const count = Math.min(4, remaining.length)
      selected = remaining.slice(0, count)
      formation = Math.random() < 0.5 ? 'V_FORMATION' : 'LINE'
    } else {
      // Wave 5+: MEGA boss + escort
      // Find a MEGA-tier commit if available
      const megaIdx = remaining.findIndex(c => determineTier(c) === 'MEGA')
      const escortCount = Math.min(3, remaining.length - (megaIdx >= 0 ? 1 : 0))

      if (megaIdx >= 0) {
        const megaCommit = remaining[megaIdx]
        // Escort from non-mega commits
        const escorts = remaining.filter((_, i) => i !== megaIdx).slice(0, escortCount)
        selected = [megaCommit, ...escorts]
        formation = 'SINGLE'
      } else {
        const count = Math.min(4, remaining.length)
        selected = remaining.slice(0, count)
        formation = 'LINE'
      }
    }

    this.currentIndex += selected.length

    const commits = buildWaveGroup(wave, selected)
    return { commits, formation }
  }

  update(delta: number, cameraPos: THREE.Vector3, scene: THREE.Scene): Boss | null {
    let killedBoss: Boss | null = null

    // Tick pending spawns
    for (let i = this.pendingSpawns.length - 1; i >= 0; i--) {
      const pending = this.pendingSpawns[i]
      pending.delay -= delta
      if (pending.delay <= 0) {
        const boss = new Boss(pending.data, pending.position, pending.tier)
        // Store baseY for hover animation
        boss.group.userData.baseY = pending.position.y
        this.activeBosses.push(boss)
        scene.add(boss.group)
        this.spawnedInWave++
        this.pendingSpawns.splice(i, 1)
      }
    }

    // Update active bosses
    for (let i = this.activeBosses.length - 1; i >= 0; i--) {
      const boss = this.activeBosses[i]
      boss.update(delta, cameraPos)

      // Check if boss reached player
      const dist = boss.getPosition().distanceTo(cameraPos)
      if (dist < boss.getBoundingRadius()) {
        boss.alive = false
      }

      if (!boss.alive) {
        if (boss.hp <= 0) {
          killedBoss = boss
        }
        scene.remove(boss.group)
        boss.dispose()
        this.activeBosses.splice(i, 1)
      }
    }

    return killedBoss
  }

  getClosestBoss(cameraPos: THREE.Vector3): Boss | null {
    let closest: Boss | null = null
    let minDist = Infinity

    for (const boss of this.activeBosses) {
      if (!boss.alive) continue
      const dist = boss.getPosition().distanceTo(cameraPos)
      if (dist < minDist) {
        minDist = dist
        closest = boss
      }
    }

    return closest
  }
}
