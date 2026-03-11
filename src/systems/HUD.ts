import type { CommitData } from '../data/types'

export class HUD {
  private repoEl: HTMLElement
  private scoreEl: HTMLElement
  private ammoEl: HTMLElement
  private bossInfoEl: HTMLElement
  private waveEl: HTMLElement
  private centerMsgEl: HTMLElement
  private crosshairEl: HTMLElement

  private kills = 0
  private waveMessageTimer = 0

  constructor() {
    this.repoEl = document.getElementById('hud-repo')!
    this.scoreEl = document.getElementById('hud-score')!
    this.ammoEl = document.getElementById('hud-ammo')!
    this.bossInfoEl = document.getElementById('hud-boss-info')!
    this.waveEl = document.getElementById('hud-wave')!
    this.centerMsgEl = document.getElementById('hud-center-msg')!
    this.crosshairEl = document.getElementById('hud-crosshair')!
  }

  setRepo(name: string, totalCommits: number) {
    this.repoEl.innerHTML = `REPO: ${name}<br>COMMITS: ${totalCommits}`
  }

  addKill() {
    this.kills++
    this.scoreEl.textContent = `KILLS: ${this.kills}`
    // Flash effect
    this.scoreEl.style.transform = 'scale(1.3)'
    setTimeout(() => {
      this.scoreEl.style.transform = 'scale(1)'
    }, 150)
  }

  setAmmo(count: number) {
    this.ammoEl.innerHTML = `AMMO: <span style="font-size:16px">&infin;</span> (${count})`
    this.ammoEl.style.color = '#0ff'
    this.ammoEl.style.textShadow = '0 0 8px #0ff'
  }

  setBossInfo(boss: CommitData | null) {
    if (!boss) {
      this.bossInfoEl.textContent = ''
      return
    }
    this.bossInfoEl.innerHTML = [
      `TARGET: ${boss.message.slice(0, 50)}`,
      `AUTHOR: ${boss.author} | ${boss.shortSha}`,
      `FILES: ${boss.files.slice(0, 3).join(', ')}`,
    ].join('<br>')
  }

  showWaveMessage(wave: number) {
    this.waveEl.textContent = `WAVE ${wave}`
    this.waveEl.style.opacity = '1'
    this.waveMessageTimer = 2
  }

  showCenterMessage(msg: string) {
    this.centerMsgEl.innerHTML = msg
    this.centerMsgEl.style.opacity = '1'
  }

  hideCenterMessage() {
    this.centerMsgEl.style.opacity = '0'
  }

  showCrosshair(show: boolean) {
    this.crosshairEl.style.opacity = show ? '1' : '0'
  }

  update(delta: number) {
    if (this.waveMessageTimer > 0) {
      this.waveMessageTimer -= delta
      if (this.waveMessageTimer <= 0) {
        this.waveEl.style.opacity = '0'
      }
    }
  }

  showGameOver(totalKills: number, repoName: string) {
    this.centerMsgEl.innerHTML = [
      'ALL ISSUES RESOLVED',
      '',
      `REPO: ${repoName}`,
      `BUGS FIXED: ${totalKills}`,
      '',
      'CLICK TO RESTART',
    ].join('<br>')
    this.centerMsgEl.style.opacity = '1'
    this.centerMsgEl.style.fontSize = '14px'
  }
}
