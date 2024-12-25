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
        this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ 
            canvas,
            antialias: true,
            powerPreference: "high-performance"
        });
        
        this.camera.position.z = 5;
        
        // Add resize listener.
        window.addEventListener('resize', this.resize);
        
        // Initial resize.
        this.resize();


        this.cube = this.createCube();
        this.scene.add(this.cube);

        // Start rendering loop.
        this.loop();
    };

    static resize = () => {
        if (!this.renderer || !this.camera) return;
        const canvas = this.ui.$refs.canvas;
        if (!canvas) return;

        // Use parent element dimensions
        const box = canvas.parentElement.getBoundingClientRect();
        const width = box.width;
        const height = box.height;

        // Update canvas and renderer size
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        
        // Update camera
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        // Update renderer with pixelRatio
        const pixelRatio = window.devicePixelRatio;
        this.renderer.setPixelRatio(pixelRatio);
        this.renderer.setSize(width, height, false);
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
        this.renderer?.dispose();
    }
}
