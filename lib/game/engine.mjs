import * as THREE from 'three';

export default class Engine {

    static ui;

    static scene;
    static camera;
    static renderer;
    static cube;

    // Store the bound resize function
    static resize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, true);
    };

    static setup(ui) {
        this.ui = ui;

        const canvas = ui.$refs.canvas;

        this.scene = new THREE.Scene();
        
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            canvas: canvas,
            alpha: false
        });
        
        this.camera.position.z = 5;
        this.resize();
        window.addEventListener('resize', this.resize);
    };

    static loop() {
        requestAnimationFrame(() => this.loop());

        this.cube.rotation.x += 0.01;
        this.cube.rotation.y += 0.01;
        this.renderer.render(this.scene, this.camera);
    };

    static createCube() {
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
        this.cube = new THREE.Mesh(geometry, material);
        return this.cube;
    };

    static cleanup() {
        // Remove the stored resize function
        window.removeEventListener('resize', this.resize);
    };

};
