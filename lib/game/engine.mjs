import { Scene, PerspectiveCamera, WebGLRenderer, PCFSoftShadowMap, DirectionalLight, AmbientLight } from 'three';
import ControllerManager from './controllers/controllerManager.mjs';
import PlayerManager from './players/playerManager.mjs';
import Gravity from './physics/gravity.mjs';
import SceneManager from './scenes/sceneManager.mjs';
import AnimationManager from './animations/animationManager.mjs';
import InputManager from './controllers/inputManager.mjs';
import FPS from './controllers/fps.mjs';
import { isInitializing } from './shared/flags.mjs';

export default class Engine {
    static scene = null;
    static cam = null;
    static rend = null;
    static frame = null;
    static time = 0;
    static isGameStarted = false;
    static fpsCounter = null;
    static lastFrameTime = 0;
    static frameCount = 0;

    static cleanup() {
        if (this.isGameStarted) {
            console.log('Skipping cleanup because the game is started');
            return;
        }

        // Stop the game loop first
        if (this.frame) {
            cancelAnimationFrame(this.frame);
            this.frame = null;
        }

        // Clean up controllers
        ControllerManager.cleanup();

        // Prevent InputManager cleanup during initialization
        if (!isInitializing.value) {
            // Clean up managers
            InputManager.cleanup();
        }

        // Clean up renderer
        if (this.rend) {
            this.rend.dispose();
            this.rend = null;
        }

        // Remove event listeners
        window.removeEventListener('resize', this.resize);

        // Reset managers
        SceneManager.reset();
        PlayerManager.reset();
        AnimationManager.reset();

        // Clear references
        this.scene = null;
        this.cam = null;
        this.time = 0;

        // Reset camera to default state
        this.resetCamera();
    };

    static resetCamera() {
        if (this.cam) {
            this.cam.position.set(0, 0, 0);
            this.cam.rotation.set(0, 0, 0);
        }
    }

    static resize = () => {
        if (!this.cam || !this.rend) return;
        this.cam.aspect = window.innerWidth / window.innerHeight;
        this.cam.updateProjectionMatrix();
        this.rend.setSize(window.innerWidth, window.innerHeight);
    };

    static setup(canvas) {
        isInitializing.value = true; // Set flag before cleanup
        this.cleanup();
        
        try {
            // 1. Initialize core components first
            this.scene = new Scene();
            this.cam = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
            this.rend = new WebGLRenderer({ canvas: canvas.value, antialias: true });
            this.time = performance.now();
            
            // 2. Setup renderer
            this.rend.setSize(window.innerWidth, window.innerHeight);
            this.rend.setClearColor(0x000000);
            this.rend.shadowMap.enabled = true;
            this.rend.shadowMap.type = PCFSoftShadowMap;

            // 3. Setup scene
            SceneManager.setup(this.scene);
            this.setupLights();

            // Add resize listener
            window.addEventListener('resize', this.resize);

            // Setup FPS counter
            this.setupFPSCounter();

        } catch (error) {
            console.error('Engine setup failed:', error);
            this.cleanup();
        }

        isInitializing.value = false; // Unset flag after setup
    }

    static setupFPSCounter() {
        this.fpsCounter = document.createElement('div');
        this.fpsCounter.style.position = 'absolute';
        this.fpsCounter.style.top = '10px';
        this.fpsCounter.style.left = '10px';
        this.fpsCounter.style.color = 'white';
        this.fpsCounter.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.fpsCounter.style.padding = '5px';
        this.fpsCounter.style.borderRadius = '5px';
        this.fpsCounter.style.fontFamily = 'monospace';
        this.fpsCounter.style.zIndex = '1000';
        document.body.appendChild(this.fpsCounter);
    }

    static updateFPSCounter() {
        const now = performance.now();
        this.frameCount++;
        if (now - this.lastFrameTime >= 1000) {
            const fps = (this.frameCount * 1000) / (now - this.lastFrameTime);
            this.fpsCounter.textContent = `FPS: ${Math.round(fps)}`;
            this.lastFrameTime = now;
            this.frameCount = 0;
        }
    }

    static setupLights() {
        const directionalLight = new DirectionalLight(0xffffff, 1);
        directionalLight.position.set(100, 100, 100);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        this.scene.add(directionalLight);

        const ambientLight = new AmbientLight(0x404040);
        this.scene.add(ambientLight);
    }

    // Remove initializeManagers method as we're doing it inline

    // Add method to get connected gamepads
    static getConnectedGamepads() {
        return InputManager.getAllGamepads();
    }

    static loop() {
        if (!this.rend || !this.scene || !this.cam) return;

        const delta = Math.min(0.1, (performance.now() - this.time) / 1000);
        this.time = performance.now();

        // Update input systems first
        InputManager.update(delta);
        
        // Then update controllers
        ControllerManager.update(delta);
        
        // Then update physics and animations
        AnimationManager.updateAnimations(delta);
        
        Gravity.apply(delta);

        FPS.preventDoubleJump();
        
        this.rend.render(this.scene, this.cam);
        this.updateFPSCounter();
        this.frame = requestAnimationFrame(() => this.loop());
    };
};