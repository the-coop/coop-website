import { Scene, PerspectiveCamera, WebGLRenderer } from 'three';
import SceneManager from './scene.mjs';
import ControlManager from './control.mjs';
import StartMenuController from './controllers/StartMenuController.mjs';

// Game engine, responsible for rendering, input, and game loop.
export default class Engine {
    // Nuxt page reference.
    static ui;

    // Three.js references.
    static scene;
    static camera;
    static renderer;

    // Setup game and act as the entry point for game library.
    static setup(ui) {
        this.ui = ui;
        const canvas = ui.$refs.canvas;

        this.scene = new Scene();
        this.camera = new PerspectiveCamera(75, 1, 0.1, 1000);
        this.renderer = new WebGLRenderer({ 
            canvas,
            antialias: true,
            powerPreference: "high-performance"
        });
        
        this.camera.position.z = 5;
        
        // Add resize listener.
        window.addEventListener('resize', this.resize);
        
        // Initial resize.
        this.resize();

        // Setup scene, currently temporary simple cube.
        SceneManager.setup();

        // Setup initial controller.
        ControlManager.change(StartMenuController)

        // Start rendering loop.
        this.loop();
    };

    // Game loop, processing movement, animations, actions.
    static loop() {
        // Handle control inputs.
        ControlManager.controller.update();

        // Process movements/animations. (Temp cube).
        SceneManager.cube.rotation.x += 0.01;
        SceneManager.cube.rotation.y += 0.01;
        
        // Render current frame/reality.
        this.renderer.render(this.scene, this.camera);

        // Start processing the next frame.
        requestAnimationFrame(() => this.loop());
    };

    // Clean up so player can client side navigate away and back without issues.
    static cleanup() {
        // Cleanup input listeners.
        // this.controller.cleanup();

        // Remove the Three renderer/meshes/textures.
        this.renderer?.dispose();
    };

    // Support changing device orientation/screen width.
    static resize = () => {
        const canvas = this.ui.$refs.canvas;
        if (!canvas) return;

        // Use parent element dimensions
        const { width, height } = canvas.parentElement.getBoundingClientRect();

        // Update canvas and renderer size
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        
        // Update camera
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        // Update renderer with pixelRatio
        const pixelRatio = window.devicePixelRatio;
        this.renderer.setPixelRatio(pixelRatio);
        this.renderer.setSize(width, height, false);
    };

};
