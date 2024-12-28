import { reactive } from 'vue';
import { Scene, PerspectiveCamera, WebGLRenderer } from 'three';
import SceneManager from './scene.mjs';
import ControlManager from './control.mjs';
import StartMenuController from './controllers/StartMenuController.mjs';
import Physics from './physics.mjs';
import PlayersManager from './players.mjs';
import PC from './controllers/inputs/pc.mjs';
import Gamepad from './controllers/inputs/gamepad.mjs';

// Game engine, responsible for rendering, input, and game loop.
export default class Engine {

    // Shared state to update UI when needed.
    static state = reactive({
        // Assume desktop until mobile is detected.
        mobile: false,

        // Used to tell UI a gamepad exists.
        gamepad: null
    });

    // Three.js references.
    static canvas;
    static scene;
    static camera;
    static renderer;

    // Setup game and act as the entry point for game library.
    static setup(canvas) {
        this.canvas = canvas.value;

        this.scene = new Scene();
        this.camera = new PerspectiveCamera(75, 1, 0.1, 1000);
        this.renderer = new WebGLRenderer({ 
            canvas: this.canvas,
            antialias: true,
            powerPreference: "high-performance"
        });
        
        this.camera.position.z = 5;
        
        // Add resize listener.
        window.addEventListener('resize', this.resize);
        
        // Initial resize, but wait for fullscreen to finish.
        requestAnimationFrame(() => this.resize());

        // Setup scene, currently temporary simple cube.
        SceneManager.setup();

        // Setup inputs and initial controller.
        ControlManager.setup();
        ControlManager.change(StartMenuController);

        // Start rendering loop.
        this.loop();
    };

    // Game loop, processing movement, animations, actions.
    static loop() {
        // Update inputs first
        PC.update();
        Gamepad.update();

        // Then update controller with combined inputs
        ControlManager.controller?.update();
        
        // Update gravity
        Physics.update(PlayersManager.players);
        
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
        const canvas = this.canvas;
        if (!canvas) return;

          // Get the display size
        const { width, height } = canvas.parentElement.getBoundingClientRect();
        const pixelRatio = window.devicePixelRatio;

        // Set size for the canvas DOM element (CSS pixels)
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        // Set actual pixel dimensions of canvas
        canvas.width = Math.floor(width * pixelRatio);
        canvas.height = Math.floor(height * pixelRatio);
        
        // Update camera
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        // Update renderer size to match canvas
        this.renderer.setSize(width, height, false);
        this.renderer.setPixelRatio(pixelRatio);
    };

};
