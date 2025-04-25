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
        
        // ADDED: Update collision debug visualization if enabled
        if (this._debugCollisions) {
            this.updateCollisionDebugVisualizers();
        }
        
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
        
        // ADDED: Validate all geometries before rendering to catch NaN errors
        try {
            let geometriesChecked = 0;
            let geometriesFixed = 0;
            
            // Traverse the scene and check for NaN values in geometries
            this.scene.traverse(object => {
                if (object.geometry) {
                    geometriesChecked++;
                    
                    // Check if it's a BufferGeometry with position attribute
                    if (object.geometry.isBufferGeometry && 
                        object.geometry.attributes && 
                        object.geometry.attributes.position) {
                        
                        const positions = object.geometry.attributes.position.array;
                        let hasNaN = false;
                        
                        // Scan for NaN values
                        for (let i = 0; i < positions.length; i++) {
                            if (isNaN(positions[i]) || !isFinite(positions[i])) {
                                hasNaN = true;
                                break;
                            }
                        }
                        
                        // If we found NaN values, fix the geometry
                        if (hasNaN) {
                            geometriesFixed++;
                            console.warn(`Found NaN values in geometry for object ${object.name || object.uuid}`);
                            
                            // Attempt to recreate the geometry if it's a standard type
                            if (object.geometry.type === 'BoxGeometry' && object.userData.originalSize) {
                                const { width, height, depth } = object.userData.originalSize;
                                object.geometry = new BoxGeometry(width, height, depth);
                            }
                            
                            // Force bounds update
                            object.geometry.computeBoundingBox();
                            object.geometry.computeBoundingSphere();
                            
                            // Update collision bounds if this is a collidable object
                            if (object.userData && object.userData.collidable) {
                                ObjectManager.updateCollidableBounds(object);
                            }
                        }
                    }
                }
            });
            
            if (geometriesFixed > 0) {
                console.log(`Fixed ${geometriesFixed} out of ${geometriesChecked} geometries with NaN values`);
            }
        } catch (geomErr) {
            console.error("Error validating geometries:", geomErr);
        }
        
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

    // NEW: Visualize collision volumes for debugging
    static updateCollisionDebugVisualizers() {
        try {
            // Clear old visualizers
            if (this._collisionVisualizers) {
                this._collisionVisualizers.forEach(helper => {
                    this.scene.remove(helper);
                });
            } else {
                this._collisionVisualizers = [];
            }
            
            // Get player from PlayersManager
            const player = window.PlayersManager?.self;
            if (!player) return;
            
            // Get nearby collidables
            const allCollidables = window.ObjectManager?.collidableObjects || [];
            const nearbyCollidables = allCollidables.filter(c => {
                if (!c || !c.object || !player.position) return false;
                const distance = c.object.position.distanceTo(player.position);
                return distance < 50; // Only show objects within 50 units
            });
            
            // Create visualizers for each collidable
            nearbyCollidables.forEach(c => {
                if (!c.obb || !c.object) return;
                
                // Create helper for OBB - more accurate than using c.aabb
                const corners = window.ObjectManager.getOBBCorners(c.obb);
                if (corners.length !== 8) return;
                
                // Create a line geometry from the OBB corners
                const edgeIndices = [
                    [0, 1], [1, 3], [3, 2], [2, 0], // Bottom face
                    [4, 5], [5, 7], [7, 6], [6, 4], // Top face
                    [0, 4], [1, 5], [2, 6], [3, 7]  // Connecting edges
                ];
                
                const points = [];
                edgeIndices.forEach(pair => {
                    points.push(corners[pair[0]], corners[pair[1]]);
                });
                
                const geometry = new BufferGeometry().setFromPoints(points);
                
                // Choose color based on object type
                let color = 0x00ff00; // Default green
                if (c.type === 'wall') {
                    color = 0xff0000; // Red for walls
                } else if (c.type === 'vehicle') {
                    color = 0x0000ff; // Blue for vehicles
                } else if (c.type === 'player') {
                    color = 0xffff00; // Yellow for player
                }
                
                const material = new LineBasicMaterial({ 
                    color: color,
                    transparent: true,
                    opacity: 0.7,
                    linewidth: c.type === 'wall' ? 3 : 1, // Thicker lines for walls
                    depthTest: false // Show through other objects
                });
                
                const helper = new LineSegments(geometry, material);
                this.scene.add(helper);
                this._collisionVisualizers.push(helper);
            });
            
        } catch (err) {
            console.error("Error updating collision visualizers:", err);
        }
    }

    // Toggle debug collision visualization
    static toggleCollisionDebug(enabled) {
        this._debugCollisions = enabled;
        
        // Remove existing visualizers if disabled
        if (!enabled && this._collisionVisualizers) {
            this._collisionVisualizers.forEach(helper => {
                this.scene.remove(helper);
            });
            this._collisionVisualizers = [];
        }
        
        // Enable OBB debugging in ObjectManager too
        if (window.ObjectManager) {
            window.ObjectManager._debugEnabled = enabled;
        }
        
        console.log(`Collision debugging ${enabled ? 'enabled' : 'disabled'}`);
    }

};
