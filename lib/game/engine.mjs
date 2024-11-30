import { Scene, PerspectiveCamera, WebGLRenderer, PCFSoftShadowMap, DirectionalLight, AmbientLight } from 'three';
import ControllerManager from './controllers/controllerManager.mjs';
import PlayerManager from './players/playerManager.mjs';
import Gravity from './physics/gravity.mjs';
import SceneManager from './scenes/sceneManager.mjs';
import AnimationManager from './animations/animationManager.mjs';
import InputManager from './controllers/inputManager.mjs';
import FPS from './controllers/fps.mjs';
import State from './state.mjs';

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
    static showFPSEnabled = false;
    static isSceneReady = false;
    static showFPS = false;
    
    // Move device detection from Vue
    static isMobile = false;
    static isSafari = false;
    static hasPointerLockSupport = false;
    
    // Game state
    static activeGamepads = new Set();
    static currentControlMode = 'fps';
    static defaultControlMode = 'fps';
    
    // Add initialization flag
    static loaded = false;
    static isInitialised = false;

    static cleanup() {
        // Stop the game loop first
        if (this.frame) {
            cancelAnimationFrame(this.frame);
            this.frame = null;
        }

        // Clear game started flag
        State.setGameStarted(false);

        // Clean up controllers if game was running
        if (this.isSceneReady) {
            ControllerManager.cleanup();
        }

        // Replace isInitializing check with loaded flag
        if (this.loaded && this.isSceneReady) {
            if (!InputManager.isGameRunning) {
                InputManager.cleanup();
            }
        }

        // Clean up scene last
        this.scene = null;
        this.cam = null;
        this.time = 0;

        if (this.rend) {
            this.rend.dispose();
            this.rend = null;
        }

        // Remove event listeners
        if (this._boundResize) {
            window.removeEventListener('resize', this._boundResize);
            this._boundResize = null;
        }

        // Reset scene manager but keep player state
        SceneManager.reset();

        // Only reset player if shutting down completely
        if (!this.loaded) {
            PlayerManager.reset();
        }

        AnimationManager.reset();

        // Reset scene ready flag
        this.isSceneReady = false;

        if (this.fpsCounter) {
            this.fpsCounter.remove();
            this.fpsCounter = null;
        }

        State.setEngineInitialised(false); // Add this line
        State.setInitialised(false); // Ensure consistency if needed

        // Reset initialization flags
        this.loaded = false;
        this.isInitialised = false;
    };

    static resetCamera() {
        if (this.cam) {
            this.cam.position.set(0, 0, 0);
            this.cam.rotation.set(0, 0, 0);
        }
    }

    static resize = () => {
        if (!this.cam || !this.rend) return;
        
        // Get current dimensions
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Update camera
        this.cam.aspect = width / height;
        this.cam.updateProjectionMatrix();
        
        // Update renderer
        this.rend.setSize(width, height, false);
        
        // Notify input managers
        if (this.isGameStarted) {
            InputManager.handleResize();
        }

        console.log('Engine resize:', { width, height });
    };

    static async setup(canvasElement) {
        if (!canvasElement) {
            throw new Error('Canvas element is required');
        }

        // Check if already initialized
        if (this.loaded || this.isInitialised) {
            console.log('Engine is already loaded or initialised.');
            return true;
        }

        this.loaded = false;
        this.isInitialised = false;
        try {
            // 1. Scene setup
            this.scene = new Scene();
            this.cam = new PerspectiveCamera(75, canvasElement.offsetWidth / window.innerHeight, 0.1, 2000);
            this.rend = new WebGLRenderer({ canvas: canvasElement, antialias: true });
            this.rend.shadowMap.enabled = true;
            this.rend.shadowMap.type = PCFSoftShadowMap;

            // 2. Scene initialization
            await SceneManager.setup(this.scene);
            this.setupLights();
            this.isSceneReady = true;

            // Initialize time
            this.time = performance.now();
            
            // Set initialization flags
            this.loaded = true;
            State.setEngineInitialised(true);
            this.isInitialised = true;

            return true;
        } catch (err) {
            console.error('Engine setup failed:', err);
            this.cleanup();
            this.isInitialised = false;
            throw err;
        }
    }

    static detectDeviceCapabilities() {
        if (typeof window === 'undefined') return;

        // Device detection
        State.setMobile(window.matchMedia('(pointer: coarse)').matches);
        State.setSafari(/^((?!chrome|android).)*safari/i.test(navigator.userAgent));
        State.setPointerLockSupport('pointerLockElement' in document || 'webkitPointerLockElement' in document || 'mozPointerLockElement' in document);

        // Add resize listener
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    static async initializeManagers() {
        console.warn('initializeManagers is deprecated, initialization happens in setup');
        return true;
    }

    static setShowFPS(value) {
        this.showFPSEnabled = value;
        if (value && !this.fpsCounter) {
            this.setupFPSCounter();
        } else if (!value && this.fpsCounter) {
            this.fpsCounter.remove();
            this.fpsCounter = null;
        }
    }

    static setupFPSCounter() {
        if (!this.showFPSEnabled) return;
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
        if (!this.showFPSEnabled) return;
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

    static handleResize() {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        if (PlayerManager.getProtagonist()?.camera) {
            PlayerManager.getProtagonist().camera.aspect = window.innerWidth / window.innerHeight;
            PlayerManager.getProtagonist().camera.updateProjectionMatrix();
        }
    }

    static async setGameStarted(started) {
        if (started && !this.loaded) {
            console.error('Cannot start game before engine is loaded');
            return;
        }

        try {
            if (started) {
                // Check if protagonist already exists
                if (!PlayerManager.getProtagonist()) {
                    console.log('Creating protagonist...');
                    const protagonist = await PlayerManager.create(this.scene, this.cam);
                    if (!protagonist) {
                        throw new Error('Failed to create protagonist');
                    }
                    // Wait a frame to ensure protagonist is properly initialized
                    await new Promise(requestAnimationFrame);
                } else {
                    console.log('Protagonist already exists');
                }

                // Initialize controllers after protagonist exists
                await ControllerManager.onGameStart();

                // Initialize FPS counter
                this.setShowFPS(true);

                // Start the game loop
                State.setGameStarted(true);
                InputManager.setGameRunning(true);
                this.loop();
            } else {
                // Cleanup when game stops
                this.setShowFPS(false);
                State.setGameStarted(false);
                InputManager.setGameRunning(false);

                if (this.frame) {
                    cancelAnimationFrame(this.frame);
                    this.frame = null;
                }

                // Clean up player
                PlayerManager.reset();
            }
        } catch (err) {
            console.error('Error setting game started:', err);
            this.cleanup();
        }
    }

    static loop() {
        if (!this.rend || !this.scene || !this.cam) return;

        const delta = Math.min(0.1, (performance.now() - this.time) / 1000);
        this.time = performance.now();

        // Get protagonist first
        const protagonist = PlayerManager.getProtagonist();
        if (!protagonist) {
            console.warn('No protagonist in game loop');
            return;
        }

        // Update input systems first
        InputManager.update(delta);
        
        // Then update controllers with protagonist
        ControllerManager.update(delta);
        
        // Then update physics and animations
        AnimationManager.updateAnimations(delta);
        Gravity.apply(delta);
        FPS.preventDoubleJump();

        // Render
        this.rend.render(this.scene, this.cam);
        if (this.showFPSEnabled) {
            this.updateFPSCounter();
        }
        
        this.frame = requestAnimationFrame(() => this.loop());
    };
};