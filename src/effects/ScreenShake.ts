import * as THREE from 'three'

export class ScreenShake {
  private intensity = 0
  private decay = 8
  private originalPosition = new THREE.Vector3()

  shake(intensity = 0.3) {
    this.intensity = Math.max(this.intensity, intensity)
  }

  update(delta: number, camera: THREE.Camera) {
    if (this.intensity <= 0.001) {
      this.intensity = 0
      return
    }

    camera.position.x += (Math.random() - 0.5) * this.intensity
    camera.position.y += (Math.random() - 0.5) * this.intensity * 0.5

    this.intensity -= this.intensity * this.decay * delta
  }
}
