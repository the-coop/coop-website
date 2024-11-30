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
    static fpsCounter = null;
    static lastFrameTime = 0;
    static frameCount = 0;
    static showFPSEnabled = false;
    static isSceneReady = false;
    static showFPS = false;
    
    // Device detection moved to State
    static isMobile = false;
    static isSafari = false;
    static hasPointerLockSupport = false;
    
    // Game state managed via State.mjs
    static activeGamepads = new Set();
    static currentControlMode = 'fps';
    static defaultControlMode = 'fps';
    
    // Initialization flags
    static loaded = false;
    static isInitialised = false;
    static isSetup = false; // Prevent multiple setups

    // Internal engine state management via State.mjs
    // Removed duplicated 'state' object

    static cleanup() {
        if (!this.isSetup) return; // Ensure cleanup happens only if setup was done

        // Avoid cleanup if the game is still running
        if (State.isGameStarted) {
            console.warn('Engine cleanup skipped: Game is still running.');
            return;
        }

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
        this.isSetup = false; // Reset setup flag
        State.setShowSettings(false); // Update UI-related cleanup directly in State.mjs
        console.log('Engine has been cleaned up.');
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
        if (State.isGameStarted) {
            InputManager.handleResize();
        }

        console.log('Engine resize:', { width, height });
    };

    static async setup(canvasElement) {
        if (!canvasElement) {
            throw new Error('Canvas element is required');
        }

        if (this.isSetup) { // Check setup flag
            console.log('Engine is already set up.');
            return true;
        }

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
            
            // Set loaded and setup flags
            this.loaded = true;
            this.isSetup = true;
            State.setEngineInitialised(true);

            // Detect device capabilities
            this.detectDeviceCapabilities();

            // Don't set isGameStarted here; it should be set when the game actually starts

            // Return success
            return true;
        } catch (err) {
            console.error('Engine setup failed:', err);
            this.cleanup();
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
        window.addEventListener('resize', this.resize.bind(this)); // Ensure 'this' context
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

    // Add method to get connected gamepads
    static getConnectedGamepads() {
        return InputManager.getAllGamepads();
    }

    // Method to get state snapshot for UI
    static getStateForUI() {
        return {
            game: {
                isStarted: State.isGameStarted,
                controlMode: State.controlMode,
                fps: State.fps, // Changed from this.state.fps
                players: [...State.players],
                gamepads: [...State.connectedGamepads]
            },
            environment: { 
                isMobile: State.isMobile,
                isSafari: State.isSafari,
                isPointerLockSupported: State.isPointerLockSupported,
                // Add other environment properties as needed
            }
        };
    }

    static async setGameStarted(started) {
        if (started && State.isGameStarted) {
            console.warn('Game is already started.');
            return false;
        }

        try {
            if (started) {
                if (!this.loaded) {
                    throw new Error('Cannot start game before engine is loaded');
                }

                // Call startGame method to handle all initialization
                const success = await this.startGame();
                if (!success) {
                    throw new Error('Failed to start game');
                }

                // Start game loop only after successful initialization
                this.loop();
                return true;
            } else {
                // Stop game
                State.setGameStarted(false);
                if (this.frame) {
                    cancelAnimationFrame(this.frame);
                    this.frame = null;
                }
                return true;
            }
        } catch (err) {
            console.error('Error setting game started:', err);
            State.setGameStarted(false);
            return false;
        }
    }

    static async startGame() {
        if (State.isGameStarted) {
            console.warn('Engine: Game is already started.');
            return false;
        }

        try {
            // 1. Initialize Player Manager with the scene FIRST
            console.log('Setting up player manager...');
            await PlayerManager.setup(this.scene);
            
            // 2. Get and verify protagonist
            const protagonist = PlayerManager.getProtagonist();
            if (!protagonist) {
                throw new Error('Failed to create protagonist');
            }
            
            // 3. Set protagonist in state
            State.setProtagonist(protagonist);
            console.log('Protagonist created and stored in state');

            // 4. Then initialize Controllers
            console.log('Setting up controller manager...');
            const controllerSetupSuccess = await ControllerManager.setup();
            if (!controllerSetupSuccess) {
                throw new Error('Failed to set up ControllerManager.');
            }

            // 5. Initialize Input Manager
            console.log('Setting up input manager...');
            const inputSetupSuccess = await InputManager.setup();
            if (!inputSetupSuccess) {
                throw new Error('Failed to set up InputManager.');
            }

            // 6. Set game started state LAST
            State.setGameStarted(true);
            State.setShowSettings(false);
            console.log('Engine: Game started successfully.');
            return true;
        } catch (err) {
            console.error('Engine: startGame failed:', err);
            State.addLog(`Engine startGame failed: ${err.message}`, 'engine.mjs');
            return false;
        }
    }

    static loop() {
        if (!this.rend || !this.scene || !this.cam) return;

        const delta = Math.min(0.1, (performance.now() - this.time) / 1000);
        this.time = performance.now();

        // Update internal state
        State.setFPS(Math.round(1 / delta)); // Changed from this.state.fps

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
    }
};