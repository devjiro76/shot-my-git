import * as THREE from 'three'

export class Environment {
  private gridHelper!: THREE.GridHelper
  private particles!: THREE.Points

  setup(scene: THREE.Scene) {
    // Neon grid floor
    this.gridHelper = new THREE.GridHelper(200, 80, 0x00ff41, 0x003300)
    this.gridHelper.position.y = 0
    const gridMat = this.gridHelper.material as THREE.Material
    gridMat.opacity = 0.6
    gridMat.transparent = true
    scene.add(this.gridHelper)

    // Ambient light (dim)
    const ambient = new THREE.AmbientLight(0x111111)
    scene.add(ambient)

    // Forward point light (player carries light)
    const playerLight = new THREE.PointLight(0x00ff41, 2, 50)
    playerLight.position.set(0, 5, 0)
    playerLight.name = 'playerLight'
    scene.add(playerLight)

    // Background star particles
    const starGeo = new THREE.BufferGeometry()
    const starCount = 500
    const starPositions = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 200
      starPositions[i * 3 + 1] = Math.random() * 80 + 5
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 200
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    const starMat = new THREE.PointsMaterial({
      color: 0x00ff41,
      size: 0.5,
      transparent: true,
      opacity: 0.4,
    })
    this.particles = new THREE.Points(starGeo, starMat)
    scene.add(this.particles)
  }

  update(cameraPosition: THREE.Vector3) {
    // Move player light to follow camera
    const playerLight = this.gridHelper.parent?.getObjectByName('playerLight')
    if (playerLight) {
      playerLight.position.set(cameraPosition.x, 5, cameraPosition.z)
    }
  }
}
