import * as THREE from 'three'

export class Scene {
  static scene = null
  static camera = null
  static renderer = null
  static levelObjects = []

  static init(container) {
    // Setup Three.js scene
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(this.renderer.domElement)

    // Setup scene
    this.scene.background = new THREE.Color(0x87ceeb)
    this.scene.fog = new THREE.Fog(0x87ceeb, 10, 100)

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    this.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(50, 50, 25)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.left = -50
    directionalLight.shadow.camera.right = 50
    directionalLight.shadow.camera.top = 50
    directionalLight.shadow.camera.bottom = -50
    directionalLight.shadow.camera.near = 0.1
    directionalLight.shadow.camera.far = 200
    this.scene.add(directionalLight)

    // Create ground
    const groundGeometry = new THREE.BoxGeometry(100, 1, 100)
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x3a5f3a })
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.position.y = -0.5
    ground.receiveShadow = true
    this.scene.add(ground)
    
    // Setup camera
    this.camera.position.set(0, 15, 20)
    this.camera.lookAt(0, 0, 0)
  }

  static createLevel(levelData) {
    // Remove any existing level objects
    for (const obj of this.levelObjects) {
      this.scene.remove(obj)
      obj.geometry.dispose()
      obj.material.dispose()
    }
    this.levelObjects = []
    
    // Create objects from server data
    for (const objData of levelData) {
      if (objData.type === 'cube') {
        const geometry = new THREE.BoxGeometry(objData.size.x, objData.size.y, objData.size.z)
        const material = new THREE.MeshLambertMaterial({ 
          color: objData.color 
        })
        const cube = new THREE.Mesh(geometry, material)
        cube.position.set(
          objData.position.x,
          objData.position.y,
          objData.position.z
        )
        cube.castShadow = true
        cube.receiveShadow = true
        this.scene.add(cube)
        this.levelObjects.push(cube)
      }
    }
  }

  static render() {
    this.renderer.render(this.scene, this.camera)
  }

  static cleanup() {
    // Clean up level objects
    for (const obj of this.levelObjects) {
      this.scene.remove(obj)
      obj.geometry.dispose()
      obj.material.dispose()
    }
    this.levelObjects = []
  }
}
