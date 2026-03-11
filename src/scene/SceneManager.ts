import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'

export class SceneManager {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: PointerLockControls
  clock: THREE.Clock

  private moveState = { forward: false, backward: false, left: false, right: false }
  private velocity = new THREE.Vector3()
  private direction = new THREE.Vector3()
  private moveSpeed = 30

  constructor(canvas: HTMLCanvasElement) {
    this.clock = new THREE.Clock()
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x000000)
    this.scene.fog = new THREE.FogExp2(0x000000, 0.015)

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200)
    this.camera.position.set(0, 3, 0)

    // Low-res renderer for pixel look (2 = mild retro, 4 = heavy pixel)
    const pixelScale = 1.5
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    this.renderer.setPixelRatio(1 / pixelScale)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    // FPS controls
    this.controls = new PointerLockControls(this.camera, document.body)
    this.scene.add(this.controls.object)

    this.setupInput()
    this.setupResize()
  }

  private setupInput() {
    document.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': this.moveState.forward = true; break
        case 'KeyS': case 'ArrowDown': this.moveState.backward = true; break
        case 'KeyA': case 'ArrowLeft': this.moveState.left = true; break
        case 'KeyD': case 'ArrowRight': this.moveState.right = true; break
      }
    })
    document.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': this.moveState.forward = false; break
        case 'KeyS': case 'ArrowDown': this.moveState.backward = false; break
        case 'KeyA': case 'ArrowLeft': this.moveState.left = false; break
        case 'KeyD': case 'ArrowRight': this.moveState.right = false; break
      }
    })
  }

  private setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(window.innerWidth, window.innerHeight)
    })
  }

  lock() {
    this.controls.lock()
  }

  isLocked(): boolean {
    return this.controls.isLocked
  }

  updateMovement(delta: number) {
    if (!this.controls.isLocked) return

    this.velocity.x -= this.velocity.x * 8.0 * delta
    this.velocity.z -= this.velocity.z * 8.0 * delta

    this.direction.z = Number(this.moveState.forward) - Number(this.moveState.backward)
    this.direction.x = Number(this.moveState.right) - Number(this.moveState.left)
    this.direction.normalize()

    if (this.moveState.forward || this.moveState.backward) {
      this.velocity.z -= this.direction.z * this.moveSpeed * delta
    }
    if (this.moveState.left || this.moveState.right) {
      this.velocity.x -= this.direction.x * this.moveSpeed * delta
    }

    this.controls.moveRight(-this.velocity.x * delta)
    this.controls.moveForward(-this.velocity.z * delta)

    // Lock Y position
    this.camera.position.y = 3
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }

  getForwardDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3()
    this.camera.getWorldDirection(dir)
    return dir
  }

  getCameraPosition(): THREE.Vector3 {
    return this.camera.position.clone()
  }
}
