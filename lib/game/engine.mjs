import * as THREE from 'three'

export default class Game {
    static scene = new THREE.Scene()
    static cam = null
    static fx = null
    static box = null
    static rid = null
    static resizeHandler = null

    static setup(el) {
        this.cam = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, .1, 1000)
        this.fx = new THREE.WebGLRenderer()
        this.box = new THREE.Mesh(
            new THREE.BoxGeometry(),
            new THREE.MeshBasicMaterial({color: 0x00ff00})
        )
        
        this.cam.position.z = 5
        this.fx.setSize(window.innerWidth, window.innerHeight)
        this.fx.domElement.style.display = 'none'
        this.scene.add(this.box)
        el.appendChild(this.fx.domElement)
        
        // Add resize handler
        this.resizeHandler = () => {
            this.cam.aspect = window.innerWidth / window.innerHeight
            this.cam.updateProjectionMatrix()
            this.fx.setSize(window.innerWidth, window.innerHeight)
        }
        window.addEventListener('resize', this.resizeHandler)
        
        // Start game loop
        this.run = this.run.bind(this)
        this.rid = requestAnimationFrame(this.run)
        this.fx.domElement.style.display = 'block'
    }

    static run() {
        if (!this.fx || !this.cam) return
        
        this.box.rotation.x += .01
        this.box.rotation.y += .01
        this.fx.render(this.scene, this.cam)
        this.rid = requestAnimationFrame(this.run)
    }

    static end() {
        if (this.rid) {
            cancelAnimationFrame(this.rid)
            this.rid = null
        }
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler)
            this.resizeHandler = null
        }
        if (this.fx) {
            this.fx.dispose()
            this.fx.domElement?.remove()
            this.fx = null
        }
        if (this.box) {
            this.box.geometry.dispose()
            this.box.material.dispose()
            this.scene.remove(this.box)
            this.box = null
        }
        this.cam = null
    }
}
