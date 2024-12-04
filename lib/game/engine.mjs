import * as THREE from 'three';

export default class Engine {

    static ui;

    static scene;
    static camera;
    static renderer;
    static cube;

    static setup(ui) {
        this.ui = ui;

        const canvas = ui.$refs.canvas;

        this.scene = new THREE.Scene();
        
        const width = canvas.clientWidth || window.innerWidth;
        const height = canvas.clientHeight || window.innerHeight;
        
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
        
        this.renderer.setSize(width, height);
        this.camera.position.z = 5;

        window.addEventListener('resize', Engine.resize);
    };

    static loop() {
        requestAnimationFrame(this.loop.bind(this));

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

    static resize() {
        const width = this.renderer.domElement.parentElement.clientWidth;
        const height = this.renderer.domElement.parentElement.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    };

    static cleanup() {
        window.removeEventListener('resize', this.resize);
    };

};
