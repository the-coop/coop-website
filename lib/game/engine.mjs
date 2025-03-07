import { reactive } from 'vue';
import { Scene, PerspectiveCamera, WebGLRenderer } from 'three';
import SceneManager from './scene.mjs';
import ControlManager from './control.mjs';
import Physics from './physics.mjs';
import ObjectManager from './object.mjs';

// Core game engine using Three.js for rendering and Vue for reactive state
// State is exposed to UI components through Vue's reactive system
export default class Engine {
    // Reactive state for UI updates - mobile detection happens at runtime
    static state = reactive({
        mobile: false,
        gamepad: null
    });

    // Three.js core components.
    static canvas;
    static scene;
    static camera;
    static renderer;

    // Main entry point - initializes rendering pipeline and starts game loop
    static setup(canvas) {
        // Attach the game canvas to Three.
        this.canvas = canvas.value;

        // Setup basic Three components.
        this.scene = new Scene();
        this.camera = new PerspectiveCamera(75, 1, 0.1, 5000);
        this.renderer = new WebGLRenderer({ 
            canvas: this.canvas,
            antialias: true,
            powerPreference: "high-performance"
        });
        
        // Set initial camera position before spawning.
        this.camera.position.z = 5;

        // Setup scene, currently temporary simple cube.
        SceneManager.setup();
        
        // Setup inputs and initial controller.
        ControlManager.setup();
        
        // Start rendering loop.
        this.loop();

        // Add resize listener.
        window.addEventListener('resize', this.resize);
        
        // Initial resize, but wait for fullscreen to finish.
        requestAnimationFrame(() => this.resize());
    };

    // Main game loop - order of operations matters:
    // Main game loop - order of operations matters:
    // 1. Process inputs and update controller state
    // 2. Run physics simulation with new inputs
    // 3. Render the resulting frame
    static loop() {
        // Update controller and handle inputs
        ControlManager.update();
        
        // Update physics after inputs have been processed
        Physics.update();
        
        // Render current frame/reality.
        this.renderer.render(this.scene, this.camera);

        // Start processing the next frame.
        requestAnimationFrame(() => this.loop());
    };

    // Renderer cleanup is crucial for memory management during client-side navigation
    static cleanup() {
        this.renderer?.dispose();
    };

    // Handles both window resizing and device orientation changes
    // Uses CSS pixels for DOM and actual pixels for WebGL context
    static resize = () => {
        // Get the display size.
        const { width, height } = this.canvas.parentElement.getBoundingClientRect();
        const pixelRatio = window.devicePixelRatio;

        // Set actual pixel dimensions of canvas.
        this.canvas.width = Math.floor(width * pixelRatio);
        this.canvas.height = Math.floor(height * pixelRatio);
        
        // Update renderer size to match canvas.
        this.renderer.setSize(width, height, false);
        this.renderer.setPixelRatio(pixelRatio);

        // Update camera.
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    };

};
