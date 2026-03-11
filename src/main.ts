import { SceneManager } from './scene/SceneManager'
import { GitDataLoader } from './data/GitDataLoader'
import { GameLoop } from './systems/GameLoop'

async function main() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement

  // Load git data
  const loader = new GitDataLoader()
  const gitData = await loader.load('./git-data.json')

  console.log(`Loaded repo: ${gitData.repoName}`)
  console.log(`Total commits: ${gitData.totalCommits}`)
  console.log(`Bugs: ${gitData.bugCommits.length}`)
  console.log(`Code: ${gitData.codeCommits.length}`)

  // Initialize scene
  const sceneManager = new SceneManager(canvas)

  // Create game loop
  const gameLoop = new GameLoop(sceneManager, gitData)

  // Animation loop
  function animate() {
    requestAnimationFrame(animate)
    gameLoop.update()
  }

  animate()
}

main().catch(err => {
  console.error('Failed to initialize:', err)
  const center = document.getElementById('hud-center-msg')
  if (center) {
    center.textContent = 'FAILED TO LOAD GIT DATA\n\nRun: npm run extract -- <repo-path>'
    center.style.color = '#f44'
  }
})
