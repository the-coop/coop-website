import { reactive } from 'vue';
import { Scene, PerspectiveCamera, WebGLRenderer, AmbientLight, DirectionalLight } from 'three';
import SceneManager from './scene.mjs';
import ControlManager from './control.mjs';
import Physics from './physics.mjs';
import ObjectManager from './object.mjs';
import VehicleManager from './vehicles.mjs';

// Core game engine using Three.js for rendering and Vue for reactive state
// State is exposed to UI components through Vue's reactive system
export default class Engine {
    // Reactive state for UI updates - mobile detection happens at runtime
    static state = reactive({
        mobile: false,
        gamepad: null
    });

    // Track keyboard state for controller input
    static keyStates = {};

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
        this.camera = new PerspectiveCamera(75, 1, 0.1, 50000); // Increased from 5000 to 50000
        
        // Name the camera for debugging purposes
        this.camera.name = 'MainCamera';
        
        // CRITICAL FIX: Enhanced renderer settings to eliminate duplicated/mirrored images
        this.renderer = new WebGLRenderer({ 
            canvas: this.canvas,
            antialias: true,
            powerPreference: "high-performance",
            alpha: false, // Disable alpha to prevent transparency issues
            stencil: false, // Removed stencil buffer which can cause image duplication
            depth: true,  // Enable depth buffer
            precision: "highp", // Use high precision
            logarithmicDepthBuffer: false // Disable logarithmic depth buffer which can cause visual issues
        });
        
        // CRITICAL FIX: Completely clear all settings and buffers
        this.renderer.setClearColor(0x000000, 1);
        this.renderer.autoClear = true;
        this.renderer.gammaOutput = false; // Disable gamma which can cause color issues
        
        // CRITICAL FIX: Ensure renderer doesn't use any post-processing or effects
        this.renderer.shadowMap.enabled = false;
        this.renderer.localClippingEnabled = false;
        
        // Add stronger lighting to make vehicles more visible
        const ambientLight = new AmbientLight(0xffffff, 1.0); // Increased from 0.7
        this.scene.add(ambientLight);
        
        // Add multiple directional lights for better coverage
        const directionalLight1 = new DirectionalLight(0xffffff, 0.8); // Increased from 0.5
        directionalLight1.position.set(1, 1, 1);
        this.scene.add(directionalLight1);
        
        const directionalLight2 = new DirectionalLight(0xffffff, 0.6);
        directionalLight2.position.set(-1, -1, -1);
        this.scene.add(directionalLight2);
        
        // Set initial camera position before spawning.
        this.camera.position.z = 5;

        // CRITICAL FIX: Log initialization state for debugging
        console.log("Engine initialized with scene:", !!this.scene);

        // Setup inputs and initial controller before scene to ensure controls are ready
        ControlManager.setup();
        
        // CRITICAL FIX: Now that Engine.scene exists, we can safely setup the scene
        try {
            // Setup scene, currently temporary simple cube.
            SceneManager.setup();
        } catch (e) {
            console.error("Error in SceneManager.setup():", e);
        }
        
        // Start rendering loop.
        this.loop();

        // Add resize listener.
        window.addEventListener('resize', this.resize);
        
        // Initial resize, but wait for fullscreen to finish.
        requestAnimationFrame(() => this.resize());
    };

    // Main game loop - order of operations matters
    static loop() {
        // Process controller input first
        ControlManager.update();
        
        // Only update the current vehicle in VehicleManager
        VehicleManager.updateCurrentVehicle(1/60);
        
        // Skip physics for player-controlled vehicles with more specific condition
        const playerControllingVehicle = VehicleManager.currentVehicle && 
                                       VehicleManager.currentVehicle.userData.isOccupied &&
                                       (VehicleManager.currentVehicle.userData.type === 'car' || 
                                        VehicleManager.currentVehicle.userData.type === 'airplane');
        
        try {
            if (!playerControllingVehicle) {
                // Run full physics when no player-controlled vehicle exists
                Physics.update();
            } else {
                // For player-controlled vehicles, run limited physics that won't affect the current vehicle
                Physics.updateNonVehicles();
            }
        } catch (e) {
            console.error("Error during physics update:", e);
        }
        
        // Reset rendering state before each frame
        this.renderer.clear(true, true, true);
        
        // Render current frame
        this.renderer.render(this.scene, this.camera);
        
        // Start processing the next frame
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
