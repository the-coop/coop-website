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
        
        SceneManager.setup();
        
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
        
        // CRITICAL FIX: Only update the current vehicle in VehicleManager
        // This must happen BEFORE physics to avoid conflicting updates
        if (VehicleManager.currentVehicle) {
            VehicleManager.updateCurrentVehicle(1/60);
        }
        
        // Run physics for all objects with a single unified method
        try {
            // Slight delay after vehicle update to ensure no conflicts
            requestAnimationFrame(() => Physics.update());
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

    // Enhanced debug visualization for collision boxes and normals
    static updateCollisionDebugVisualizers() {
        try {
            // Clear old visualizers
            if (this._collisionVisualizers) {
                this._collisionVisualizers.forEach(helper => {
                    if (helper && helper.parent) {
                        helper.parent.remove(helper);
                    } else if (helper) {
                        this.scene.remove(helper);
                    }
                });
            }
            this._collisionVisualizers = [];
            
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
            
            // ADDED: Include the player's own collision box in the visualizations
            if (player.collidable && player.collidable.obb) {
                nearbyCollidables.push(player.collidable);
            }
            
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
                
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                
                // Choose color based on object type
                let color;
                if (c.type === 'vehicle') {
                    color = 0x0000ff; // Blue for vehicles
                } else if (c.type === 'player' || c.object === player.handle) {
                    color = 0xffff00; // Yellow for player
                } else if (c.type === 'testCube') {
                    color = 0xff00ff; // Purple for test cubes
                } else {
                    color = 0x00ff00; // Default green
                }
                
                // Highlight active collisions
                let lineWidth = 1;
                let opacity = 0.7;
                
                // If this object is currently colliding with player, highlight it
                const isCurrentlyColliding = player.activeCollisions && 
                    player.activeCollisions.some(ac => ac.object && ac.object === c.object);
                
                if (isCurrentlyColliding) {
                    color = 0xff0000; // Red for active collisions
                    lineWidth = 3;
                    opacity = 1.0;
                    
                    // ADDED: Highlight the collision face
                    this.highlightCollisionFace(c.object, c.obb, player);
                }
                
                const material = new THREE.LineBasicMaterial({ 
                    color: color,
                    transparent: true,
                    opacity: opacity,
                    linewidth: lineWidth,
                    depthTest: false // Show through other objects
                });
                
                const helper = new THREE.LineSegments(geometry, material);
                this.scene.add(helper);
                this._collisionVisualizers.push(helper);
                
                // ENHANCED: Always visualize surface normals for objects
                this.visualizeObjectNormal(c.object, c.obb.center);
                
                // For active collisions, show the collision normals
                if (isCurrentlyColliding && player.activeCollisions) {
                    const activeCollision = player.activeCollisions.find(ac => ac.object === c.object);
                    if (activeCollision && activeCollision.normal && activeCollision.position) {
                        this.visualizeCollisionNormal(activeCollision);
                    }
                }
            });
            
        } catch (err) {
            console.error("Error updating collision visualizers:", err);
        }
    }
    
    // ENHANCED: Improved surface normal visualization
    static visualizeObjectNormal(object, center) {
        try {
            if (!object || !center) return;
            
            let normal;
            let normalLength = 2.5; // Increased length for better visibility
            let normalColor = 0x00ffff; // Cyan color for surface normal
            
            // Get the appropriate normal based on object type
            if (object.userData && object.userData.surfaceNormal) {
                // Use stored surface normal if available
                normal = object.userData.surfaceNormal.clone();
                normalColor = 0x22ffdd; // Special color for surface normals
            } else if (object === PlayersManager.self?.handle) {
                // Special case for player
                normal = PlayersManager.self.surfaceNormal?.clone() || 
                         PlayersManager.self._planetSurfaceNormal?.clone() || 
                         new THREE.Vector3(0, 1, 0);
                normalColor = 0xffff00; // Yellow for player normals
                normalLength = 3.0; // Longer for player
            } else {
                // Default up normal for other objects
                normal = new THREE.Vector3(0, 1, 0);
                
                // Try to get planet-based normal for objects on planets
                if (object.userData && object.userData.planet && object.userData.planet.object) {
                    const toObj = object.position.clone()
                        .sub(object.userData.planet.object.position)
                        .normalize();
                    normal = toObj;
                    normalColor = 0x66ffaa; // Special color for planet-based normals
                }
            }
            
            // Use the object's center as the starting point
            const start = center || object.position;
            
            // Create arrow visualizing the normal
            const arrowHelper = new THREE.ArrowHelper(
                normal,
                start,
                normalLength,
                normalColor,
                0.3, // Head length - increased for visibility
                0.15  // Head width - increased for visibility
            );
            
            this.scene.add(arrowHelper);
            this._collisionVisualizers.push(arrowHelper);
            
            return arrowHelper;
        } catch (err) {
            console.error("Error visualizing object normal:", err);
            return null;
        }
    }
    
    // NEW: Highlight the face of a cube that is in collision
    static highlightCollisionFace(object, obb, player) {
        try {
            if (!object || !obb || !player || !player.position) return;
            
            // Determine which face of the OBB is closest to the player
            const objectToPlayer = new THREE.Vector3().subVectors(player.position, obb.center);
            
            // Find the dominant axis
            const localDirection = objectToPlayer.clone();
            
            // Transform to local OBB space
            const inverseRotation = new THREE.Matrix3().copy(obb.rotation).transpose();
            localDirection.applyMatrix3(inverseRotation);
            
            // Find which axis has the maximum magnitude
            const absX = Math.abs(localDirection.x);
            const absY = Math.abs(localDirection.y);
            const absZ = Math.abs(localDirection.z);
            
            let faceNormal = new THREE.Vector3();
            let size = new THREE.Vector3();
            
            // Determine which face is closest based on the dominant axis
            if (absX >= absY && absX >= absZ) {
                // X-axis is dominant
                faceNormal.set(Math.sign(localDirection.x), 0, 0);
                size.set(0, obb.halfSize.y * 2, obb.halfSize.z * 2);
            } else if (absY >= absX && absY >= absZ) {
                // Y-axis is dominant
                faceNormal.set(0, Math.sign(localDirection.y), 0);
                size.set(obb.halfSize.x * 2, 0, obb.halfSize.z * 2);
            } else {
                // Z-axis is dominant
                faceNormal.set(0, 0, Math.sign(localDirection.z));
                size.set(obb.halfSize.x * 2, obb.halfSize.y * 2, 0);
            }
            
            // Transform normal back to world space
            faceNormal.applyMatrix3(obb.rotation);
            
            // Calculate face center position
            const faceOffset = faceNormal.clone().multiply(obb.halfSize).applyMatrix3(obb.rotation);
            const faceCenter = obb.center.clone().add(faceOffset);
            
            // Create the face highlight
            const planeGeometry = new THREE.PlaneGeometry(1, 1);
            const planeMaterial = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide,
                depthTest: false
            });
            
            const facePlane = new THREE.Mesh(planeGeometry, planeMaterial);
            
            // Position and orient the face highlight
            facePlane.position.copy(faceCenter);
            
            // Set orientation to match face
            facePlane.lookAt(facePlane.position.clone().add(faceNormal));
            
            // Scale to match face size
            let scaleX, scaleY;
            
            if (absX >= absY && absX >= absZ) {
                // X face
                scaleX = size.z;
                scaleY = size.y;
            } else if (absY >= absX && absY >= absZ) {
                // Y face
                scaleX = size.x;
                scaleY = size.z;
            } else {
                // Z face
                scaleX = size.x;
                scaleY = size.y;
            }
            
            facePlane.scale.set(scaleX, scaleY, 1);
            
            this.scene.add(facePlane);
            this._collisionVisualizers.push(facePlane);
            
            // Also add a normal arrow at face center
            const faceArrow = new THREE.ArrowHelper(
                faceNormal,
                faceCenter,
                1.5, // Length
                0xff3333, // Red color
                0.2, // Head length
                0.1  // Head width
            );
            
            this.scene.add(faceArrow);
            this._collisionVisualizers.push(faceArrow);
            
            return facePlane;
        } catch (err) {
            console.error("Error highlighting collision face:", err);
            return null;
        }
    }
    
    // Enhanced visualization for collision normals
    static visualizeCollisionNormal(collision) {
        try {
            if (!collision || !collision.normal || !collision.position) return;
            
            // Create arrow helper for normal - make it thick and bright red
            const arrowHelper = new THREE.ArrowHelper(
                collision.normal.clone().normalize(),
                collision.position.clone(),
                3.0, // Increased length for visibility
                0xff0000, // Bright red color
                0.3, // Larger head length
                0.15  // Larger head width
            );
            
            this.scene.add(arrowHelper);
            this._collisionVisualizers.push(arrowHelper);
            
            // Add a small sphere at the collision point for better visibility
            const pointGeometry = new THREE.SphereGeometry(0.1, 8, 8);
            const pointMaterial = new THREE.MeshBasicMaterial({
                color: 0xffff00,
                depthTest: false
            });
            const pointMesh = new THREE.Mesh(pointGeometry, pointMaterial);
            pointMesh.position.copy(collision.position);
            
            this.scene.add(pointMesh);
            this._collisionVisualizers.push(pointMesh);
            
            return arrowHelper;
        } catch (err) {
            console.error("Error visualizing collision normal:", err);
            return null;
        }
    }

    // Toggle debug collision visualization with enhanced options
    static toggleCollisionDebug(enabled) {
        this._debugCollisions = enabled;
        
        // Remove existing visualizers if disabled
        if (!enabled && this._collisionVisualizers) {
            this._collisionVisualizers.forEach(helper => {
                if (helper && helper.parent) {
                    helper.parent.remove(helper);
                } else if (helper) {
                    this.scene.remove(helper);
                }
            });
            this._collisionVisualizers = [];
        }
        
        // ENHANCED: Always show surface normals and collision faces when debug is enabled
        if (enabled) {
            this._showCollisionDetails = true;
        }
        
        // Enable OBB debugging in ObjectManager too
        if (window.ObjectManager) {
            window.ObjectManager._debugEnabled = enabled;
            
            // Also update debug settings
            if (enabled) {
                window.ObjectManager._debugSettings = {
                    showBoxes: true,
                    showNormals: true,
                    boxOpacity: 0.5,
                    normalLength: 2,
                    highlightCollisionFaces: true // New setting
                };
            }
        }
        
        console.log(`Collision debugging ${enabled ? 'enabled with surface normals and face highlighting' : 'disabled'}`);
    }
    
    // Toggle additional collision visualization details
    static toggleCollisionDetails() {
        this._showCollisionDetails = !this._showCollisionDetails;
        
        if (window.ObjectManager) {
            // Update settings in ObjectManager to match
            if (this._debugCollisions) {
                window.ObjectManager._debugSettings.showNormals = this._showCollisionDetails;
            }
        }
        
        console.log(`Collision details ${this._showCollisionDetails ? 'enabled' : 'disabled'}`);
    }
};
