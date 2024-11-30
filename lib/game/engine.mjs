import * as THREE from 'three';

export class GameEngine {
    constructor(container) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.cube = new THREE.Mesh(
            new THREE.BoxGeometry(),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.camera.position.z = 5;
        this.scene.add(this.cube);
        container.appendChild(this.renderer.domElement);
    }

    start() {
        const animate = () => {
            requestAnimationFrame(animate);
            this.cube.rotation.x += 0.01;
            this.cube.rotation.y += 0.01;
            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }
}
