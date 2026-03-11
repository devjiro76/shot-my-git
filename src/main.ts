import { SceneManager } from './scene/SceneManager'
import { GitDataLoader } from './data/GitDataLoader'
import { GithubFetcher } from './data/GithubFetcher'
import { GameLoop } from './systems/GameLoop'
import type { GitData } from './data/types'

// ─── DOM Elements ───
const landing = document.getElementById('landing')!
const repoInput = document.getElementById('repo-input') as HTMLInputElement
const btnGo = document.getElementById('btn-go')!
const btnDemo = document.getElementById('btn-demo')!
const fileInput = document.getElementById('file-input') as HTMLInputElement
const dropZone = document.getElementById('drop-zone')!
const progressEl = document.getElementById('landing-progress')!

let gameStarted = false

// ─── Start Game ───
function startGame(gitData: GitData) {
  if (gameStarted) return
  gameStarted = true

  landing.classList.add('hidden')

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
  const sceneManager = new SceneManager(canvas)
  const gameLoop = new GameLoop(sceneManager, gitData)

  function animate() {
    requestAnimationFrame(animate)
    gameLoop.update()
  }
  animate()
}

function showProgress(msg: string) {
  progressEl.textContent = msg
  progressEl.classList.remove('error')
}

function showError(msg: string) {
  progressEl.textContent = msg
  progressEl.classList.add('error')
}

// ─── GitHub API Mode ───
async function loadFromGithub(repoSlug: string) {
  try {
    btnGo.textContent = '...'
    const fetcher = new GithubFetcher()
    const gitData = await fetcher.fetch(repoSlug, showProgress)
    startGame(gitData)
  } catch (err) {
    showError(`ERROR: ${err instanceof Error ? err.message : 'Failed to fetch'}`)
    btnGo.textContent = 'FIGHT'
  }
}

function parseRepoSlug(input: string): string | null {
  const trimmed = input.trim().replace(/\/+$/, '')
  // Full URL: https://github.com/owner/repo or github.com/owner/repo
  const urlMatch = trimmed.match(/(?:https?:\/\/)?github\.com\/([^/]+\/[^/]+)/)
  if (urlMatch) return urlMatch[1]
  // owner/repo format
  if (/^[^/]+\/[^/]+$/.test(trimmed)) return trimmed
  return null
}

btnGo.addEventListener('click', () => {
  const slug = parseRepoSlug(repoInput.value)
  if (!slug) {
    showError('FORMAT: owner/repo or GitHub URL')
    return
  }
  loadFromGithub(slug)
})

repoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnGo.click()
})

// ─── Demo Mode ───
btnDemo.addEventListener('click', async () => {
  try {
    showProgress('Loading demo data...')
    const loader = new GitDataLoader()
    const gitData = await loader.load('./git-data.json')
    startGame(gitData)
  } catch {
    showError('DEMO DATA NOT FOUND')
  }
})

// ─── File Upload / Drag-Drop ───
function loadJsonFile(file: File) {
  showProgress('Reading file...')
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const raw = JSON.parse(reader.result as string)
      const loader = new GitDataLoader()
      // Parse through loader for field normalization
      const gitData = loader.parseRaw(raw)
      startGame(gitData)
    } catch {
      showError('INVALID JSON FILE')
    }
  }
  reader.readAsText(file)
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]
  if (file) loadJsonFile(file)
})

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault()
  dropZone.classList.add('dragover')
})

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover')
})

dropZone.addEventListener('drop', (e) => {
  e.preventDefault()
  dropZone.classList.remove('dragover')
  const file = e.dataTransfer?.files[0]
  if (file && file.name.endsWith('.json')) {
    loadJsonFile(file)
  } else {
    showError('PLEASE DROP A .json FILE')
  }
})

// ─── URL param support: ?repo=owner/repo ───
const urlParams = new URLSearchParams(window.location.search)
const repoParam = urlParams.get('repo')
if (repoParam) {
  const slug = parseRepoSlug(repoParam)
  if (slug) {
    repoInput.value = slug
    loadFromGithub(slug)
  }
}
