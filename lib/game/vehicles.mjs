import { 
    BoxGeometry, 
    Mesh, 
    MeshBasicMaterial, 
    Vector3,
    Quaternion,
    Matrix4,
    CylinderGeometry,
    Object3D,
    Color
} from 'three';
import ObjectManager from './object.mjs';
import SceneManager from './scene.mjs';
import PlayersManager from './players.mjs';
import Engine from './engine.mjs';
import Physics from './physics.mjs';
import ControlManager from './control.mjs';
import CarController from './controllers/CarController.mjs'; // ADDED: Import CarController to fix reference error

export default class VehicleManager {
    // Array of all vehicles in the scene
    static vehicles = [];
    static currentVehicle = null;

    // Improve vehicle positioning and prevent bouncing - simplified to use ObjectManager
    static alignVehicleToPlanetSurface(vehicle, surfaceNormal, lerpFactor = 0.1, forceFullAlignment = false) {
        if (!vehicle || !surfaceNormal) return;
        
        // FIXED: Check if CarController exists before accessing its properties or methods
        const isCarControllerAvailable = typeof CarController !== 'undefined' && 
                                        typeof CarController.align === 'function';
        
        // Check if vehicle is controlled by CarController
        if (vehicle === this.currentVehicle && 
            vehicle.userData?._controlledByCarController &&
            isCarControllerAvailable) {
            // Delegate to CarController's unified align method
            return CarController.align(vehicle, surfaceNormal, lerpFactor);
        }
        
        // Otherwise, use centralized alignment method from ObjectManager
        // This eliminates duplicated alignment logic
        return ObjectManager.alignObjectToSurface(vehicle, surfaceNormal, {
            lerpFactor: lerpFactor,
            forceFullAlignment: forceFullAlignment,
            maintainForwardDirection: vehicle.userData?.type === 'car', // Preserve steering direction for cars
            skipIfFalling: vehicle.userData?.falling && !forceFullAlignment,
            alignmentType: 'vehicle'
        });
    }

    // Create a car on the specified planet at the given coordinates
    static createCarOnSurface(planet, latitude, longitude, heightOffset = 3) {
        try {
            // console.log(`Creating car on planet ${planet.name} at lat=${latitude}, lon=${longitude}, height=${heightOffset}`);
            
            // FIXED: Use lower height offset for better stability on spawn
            const adjustedHeightOffset = heightOffset || 10; // Reduced from 50
            const car = this.createVehicleBase('car', planet, latitude, longitude, adjustedHeightOffset);
            
            if (!car) {
                console.error("Failed to create vehicle base object");
                return null;
            }
            
            // Setup the car components
            this.setupCarComponents(car);
            
            return car;
        } catch (err) {
            console.error("Error creating car on surface:", err);
            return null;
        }
    }

    // Helper method to set up airplane-specific components
    static setupAirplaneComponents(vehicle) {
        if (!vehicle) return;
        
        try {
            // Create airplane body
            const bodyGeometry = new BoxGeometry(4, 1.2, 6);
            const bodyMaterial = new MeshBasicMaterial({ color: 0x3366FF });
            const body = new Mesh(bodyGeometry, bodyMaterial);
            body.position.y = -0.2;
            vehicle.add(body);
            
            // Create wings
            const wingGeometry = new BoxGeometry(12, 0.5, 2);
            const wingMaterial = new MeshBasicMaterial({ color: 0x4477FF });
            const wings = new Mesh(wingGeometry, wingMaterial);
            wings.position.y = 0.3;
            wings.position.z = 0;
            vehicle.add(wings);
            
            // Create tail
            const tailGeometry = new BoxGeometry(3, 1.5, 1);
            const tailMaterial = new MeshBasicMaterial({ color: 0x4477FF });
            const tail = new Mesh(tailGeometry, tailMaterial);
            tail.position.y = 0.5;
            tail.position.z = -3;
            vehicle.add(tail);
            
            // Create propeller
            const propellerGeometry = new BoxGeometry(3, 0.2, 0.2);
            const propellerMaterial = new MeshBasicMaterial({ color: 0x333333 });
            const propeller = new Mesh(propellerGeometry, propellerMaterial);
            propeller.position.z = 3.1;
            vehicle.add(propeller);
            
            // Store reference to propeller for animation
            vehicle.userData.propeller = propeller;
            
            // Register proper collision dimensions
            const airplaneWidth = 12;
            const airplaneHeight = 2;
            const airplaneLength = 6;
            
            vehicle.userData.width = airplaneWidth;
            vehicle.userData.height = airplaneHeight;
            vehicle.userData.depth = airplaneLength;
            
            const dimensions = {
                width: airplaneWidth,
                height: airplaneHeight,
                depth: airplaneLength
            };
            
            // Register with collision system
            const collidable = ObjectManager.registerGameObject(vehicle, 'vehicle', dimensions, false);
            vehicle.collidable = collidable;
            vehicle.userData.collidable = collidable;
            
            // IMPROVED: Set up enhanced collision properties
            if (collidable && collidable.obb) {
                collidable.obb.userData = {
                    isVehicle: true,
                    vehicleReference: vehicle,
                    vehicleType: 'airplane'
                };
                
                // FIXED: Use userData.id instead of id property
                collidable.debugName = `Airplane-${vehicle.userData.id || Math.floor(Math.random() * 1000)}`;
            }
            
            // Set physics properties
            vehicle.userData.mass = 500;
            vehicle.userData.velocity = new Vector3(0, 0, 0);
            vehicle.userData.falling = true;
            vehicle.userData.speed = 0;
            vehicle.userData.maxSpeed = 50;
            vehicle.userData.acceleration = 0;
            vehicle.userData.drag = 0.02;
            vehicle.userData.bounceFactor = 0.05;
            vehicle.userData.landingDamping = 0.97;
            
            // CRITICAL FIX: Increase fixed height offset to prevent clipping into planet
            vehicle.userData.fixedHeightOffset = 5.5;
            
            vehicle.userData.lift = 0.05;
            vehicle.userData.gravityFactor = 0.25;
            vehicle.userData.rotationDamping = 0.99;
            vehicle.userData.freshlySpawned = true;
            vehicle.userData.stabilizationFactor = 0.9;
            
            // CRITICAL FIX: Create a specialized method for tracking this vehicle's state
            vehicle.checkCollisions = function() {
                if (this.collidable && typeof ObjectManager.checkObjectCollisions === 'function') {
                    return ObjectManager.checkObjectCollisions(this);
                }
                return [];
            };
            
            // Add to registry
            this.vehicles.push(vehicle);
            
        } catch (err) {
            console.error("Error setting up airplane components:", err);
        }
        
        return vehicle;
    }

    // Create a basic vehicle object
    static createVehicleBase(type, planet, latitude, longitude, heightOffset = 2) {
        try {
            if (!planet || !planet.object) {
                console.error(`Invalid planet provided: ${planet ? 'missing object property' : 'null'}`);
                return null;
            }
            
            // console.log(`Creating ${type} at lat=${latitude}, lon=${longitude}, height=${heightOffset}`);
            
            // Create a new Object3D as the vehicle's container
            const vehicle = new Object3D();
            vehicle.name = `Vehicle-${type}-${Math.floor(Math.random() * 10000)}`;
            
            // Add initial userData
            vehicle.userData = {
                type: type,
                isVehicle: true,
                isOccupied: false,
                planet: planet,
                heightOffset: heightOffset,  // Store original height offset
                initialHeight: heightOffset, // Track initial height separately
                creationTime: Date.now()
            };
            
            // // IMPROVED: For high altitude spawns, log detailed info
            // if (heightOffset > 1000) {
            //     console.log(`Creating high-altitude ${type} above ${planet.name} with height=${heightOffset}`);
            // }
            
            // Position the vehicle on the planet surface
            SceneManager.positionObjectOnPlanet(vehicle, planet, latitude, longitude, heightOffset);
            
            // ADDED: Validate position after creation
            const distanceFromPlanet = vehicle.position.distanceTo(planet.object.position);
            const expectedDistance = planet.radius + heightOffset;
            
            console.log(`Vehicle created at distance ${distanceFromPlanet} from planet center`);
            console.log(`Expected distance: ${expectedDistance}`);
            
            if (Math.abs(distanceFromPlanet - expectedDistance) > 10) {
                console.warn(`Vehicle height is off by ${Math.abs(distanceFromPlanet - expectedDistance)}. Correcting...`);
                
                // Fix position directly
                const toVehicle = vehicle.position.clone().sub(planet.object.position).normalize();
                const correctedPosition = toVehicle.multiplyScalar(expectedDistance);
                vehicle.position.copy(planet.object.position).add(correctedPosition);
                
                // Log the correction
                const newDistance = vehicle.position.distanceTo(planet.object.position);
                console.log(`Corrected vehicle position. New distance: ${newDistance}`);
            }
            
            // Store the original position for physics to maintain
            vehicle.userData.originalPosition = vehicle.position.clone();
            
            // Add to scene
            Engine.scene.add(vehicle);
            
            return vehicle;
        } catch (err) {
            console.error("Error creating vehicle object:", err);
            return null;
        }
    }

    // NEW METHOD: Create a vehicle directly at a given position
    static createVehicleWithPosition(type, planet, position, suppressAlignment = false) {
        try {
            if (!planet || !planet.object) {
                console.error(`Invalid planet provided: ${planet ? 'missing object property' : 'null'}`);
                return null;
            }
            
            if (!position || !(position instanceof Vector3)) {
                console.error("Invalid position provided - must be a Vector3");
                return null;
            }
            
            // Create a new Object3D as the vehicle's container
            const vehicle = new Object3D();
            vehicle.name = `Vehicle-${type}-${Math.floor(Math.random() * 10000)}`;
            
            // IMPORTANT: Add to scene first, then set position to ensure world coordinates
            Engine.scene.add(vehicle);
            
            // ABSOLUTELY CRITICAL FIX: Copy position directly without any transforms
            vehicle.position.copy(position);
            
            // Debug logging for position tracing
            console.log(`VEHICLE CREATION - Initial position set: [${vehicle.position.x.toFixed(2)}, ${vehicle.position.y.toFixed(2)}, ${vehicle.position.z.toFixed(2)}]`);
            
            // Calculate height above planet for reference
            const distanceFromPlanet = vehicle.position.distanceTo(planet.object.position);
            const heightAboveSurface = distanceFromPlanet - planet.radius;
            
            // Add initial userData with physics properties
            vehicle.userData = {
                type: type,
                isVehicle: true,
                isOccupied: false,
                planet: planet,
                soi: planet, 
                heightOffset: heightAboveSurface,
                distanceFromPlanet: distanceFromPlanet,
                creationTime: Date.now(),
                initialSpawnInSpace: true,
                gravityFactor: 0.01, // Very low gravity for dramatic effect
                inSpace: heightAboveSurface > 1000, // Flag for high-altitude spawns
                
                // Debug tracking
                positionHistory: []
            };
            
            // Store the original position for physics reference
            vehicle.userData.originalPosition = vehicle.position.clone();
            
            // Calculate surface normal for orientation
            const surfaceNormal = vehicle.position.clone()
                .sub(planet.object.position)
                .normalize();
                
            // CRITICAL FIX: For suppressed alignment, don't apply any orientation
            if (suppressAlignment) {
                vehicle.userData.surfaceNormal = surfaceNormal;
                console.log("Vehicle alignment suppressed - maintaining space orientation");
            } else {
                // Apply initial orientation
                const defaultUp = new Vector3(0, 1, 0);
                const rotationAxis = new Vector3().crossVectors(defaultUp, surfaceNormal).normalize();
                
                if (rotationAxis.lengthSq() > 0.001) {
                    const angle = Math.acos(Math.min(1, Math.max(-1, defaultUp.dot(surfaceNormal))));
                    const alignmentQuaternion = new Quaternion().setFromAxisAngle(rotationAxis, angle);
                    vehicle.quaternion.copy(alignmentQuaternion);
                }
                
                // Store surface normal for physics calculations
                vehicle.userData.surfaceNormal = surfaceNormal;
            }
            
            // Now add the type-specific components
            if (type === 'car') {
                this.setupCarComponents(vehicle);
            } else if (type === 'airplane') {
                this.setupAirplaneComponents(vehicle);
            }
            
            // CRITICAL FIX: Force update matrix world to lock in position
            vehicle.updateMatrix();
            vehicle.updateMatrixWorld(true);
            
            // Override physics settings for high altitude spawns
            if (heightAboveSurface > 1000) {
                vehicle.userData.velocity = new Vector3(0, 0, 0); // Start with zero velocity
                vehicle.userData.gravityFactor = 0.01; // Very low gravity for dramatic entry
                vehicle.userData.falling = true;
                vehicle.userData.freshlySpawned = true;
                vehicle.userData.bounceFactor = 0.01; // Almost no bounce
                vehicle.userData.landingDamping = 0.99; // Very high damping for smooth landing
            }
            
            // Add to registry
            this.vehicles.push(vehicle);
            
            // Final position check
            console.log(`VEHICLE FINAL POSITION: [${vehicle.position.x.toFixed(2)}, ${vehicle.position.y.toFixed(2)}, ${vehicle.position.z.toFixed(2)}]`);
            console.log(`Height above planet surface: ${heightAboveSurface.toFixed(2)}`);
            
            return vehicle;
        } catch (err) {
            console.error("Error creating vehicle at position:", err);
            return null;
        }
    }

    // Helper method to set up car-specific components
    static setupCarComponents(vehicle) {
        if (!vehicle) return;
        
        try {
            // Create car body
            const bodyGeometry = new BoxGeometry(3, 1.5, 5);        
            const bodyMaterial = new MeshBasicMaterial({ color: 0xFF0000 });
            const body = new Mesh(bodyGeometry, bodyMaterial);
            body.position.y = -0.2; // Raised body position slightly from -0.5 to -0.2
            vehicle.add(body);
            
            // Create wheels collection for animation
            vehicle.userData.wheels = {};
            
            const wheelGeometry = new CylinderGeometry(0.6, 0.6, 0.5, 16);        
            const wheelMaterial = new MeshBasicMaterial({ 
                color: 0x111111, 
                transparent: false,
                wireframe: false
            });
            
            // FIXED: Correct wheel positioning and orientation to match Three.js coordinate system
            // In Three.js: +Z is backwards (rear), -Z is forwards (front)
            
            // Front left wheel (visually in front - negative Z)
            const wheelFL = new Mesh(wheelGeometry, wheelMaterial);
            wheelFL.position.set(-1.7, -1.1, -1.8); // Front position (negative Z)
            wheelFL.rotation.z = Math.PI / 2; // Rotate so wheel faces correct direction
            wheelFL.rotation.y = 0; // No steering at start
            vehicle.add(wheelFL);
            vehicle.userData.wheels.frontLeft = wheelFL;
            
            // Front right wheel (visually in front - negative Z)
            const wheelFR = new Mesh(wheelGeometry, wheelMaterial);
            wheelFR.position.set(1.7, -1.1, -1.8); // Front position (negative Z)
            wheelFR.rotation.z = Math.PI / 2; // Rotate so wheel faces correct direction
            wheelFR.rotation.y = 0; // No steering at start
            vehicle.add(wheelFR);
            vehicle.userData.wheels.frontRight = wheelFR;
            
            // Rear left wheel (visually in back - positive Z)
            const wheelRL = new Mesh(wheelGeometry, wheelMaterial);
            wheelRL.position.set(-1.7, -1.1, 1.8); // Rear position (positive Z)  
            wheelRL.rotation.z = Math.PI / 2; // Rotate so wheel faces correct direction
            wheelRL.rotation.y = 0; // No steering for rear wheels
            vehicle.add(wheelRL);
            vehicle.userData.wheels.rearLeft = wheelRL;
            
            // Rear right wheel (visually in back - positive Z)
            const wheelRR = new Mesh(wheelGeometry, wheelMaterial);
            wheelRR.position.set(1.7, -1.1, 1.8); // Rear position (positive Z)
            wheelRR.rotation.z = Math.PI / 2; // Rotate so wheel faces correct direction
            wheelRR.rotation.y = 0; // No steering for rear wheels
            vehicle.add(wheelRR);
            vehicle.userData.wheels.rearRight = wheelRR;
            
            // Place windshield at front (negative Z)
            const windshieldGeometry = new BoxGeometry(2.8, 0.8, 0.1);
            const windshieldMaterial = new MeshBasicMaterial({ 
                color: 0x88CCFF, 
                transparent: true,
                opacity: 0.7
            });
            const windshield = new Mesh(windshieldGeometry, windshieldMaterial);
            windshield.position.set(0, 0.5, -0.7); // Front position (negative Z)
            windshield.rotation.x = Math.PI / 6; // Angled windshield
            vehicle.add(windshield);

            // Register collision dimensions
            const carWidth = 3;
            const carHeight = 1.5;
            const carLength = 5;
            
            vehicle.userData.width = carWidth;
            vehicle.userData.height = carHeight;
            vehicle.userData.depth = carLength;
            
            const dimensions = {
                width: carWidth,
                height: carHeight,
                depth: carLength
            };
            
            // Register with collision system
            const collidable = ObjectManager.registerGameObject(vehicle, 'vehicle', dimensions, false);
            vehicle.collidable = collidable;
            vehicle.userData.collidable = collidable;
            
            // IMPROVED: Set up enhanced collision properties
            if (collidable && collidable.obb) {
                collidable.obb.userData = {
                    isVehicle: true,
                    vehicleReference: vehicle,
                    vehicleType: 'car'
                };
                
                // FIXED: Use userData.id instead of id property
                collidable.debugName = `Car-${vehicle.userData.id || Math.floor(Math.random() * 1000)}`;
            }
            
            // IMPROVED: More realistic car mass and physics properties
            vehicle.userData.mass = 1500; // Standard car mass in kg
            vehicle.userData.velocity = new Vector3(0, 0, 0);
            vehicle.userData.falling = true;
            vehicle.userData.speed = 0;
            vehicle.userData.maxSpeed = 12; // Reduced from 20
            vehicle.userData.acceleration = 0;
            vehicle.userData.drag = 0.08; // Increased from 0.05
            vehicle.userData.bounceFactor = 0.02; // REDUCED from 0.05 to make collisions less bouncy
            vehicle.userData.landingDamping = 0.98;
            
            // NEW: Track momentum for more realistic collisions
            vehicle.userData.getMomentum = function() {
                if (!this.velocity) return new Vector3();
                return this.velocity.clone().multiplyScalar(this.mass || 1500);
            };
            
            // CRITICAL FIX: Increase fixed height offset to prevent wheel clipping
            vehicle.userData.fixedHeightOffset = 2.2; // Increased from 1.8 to 2.2
            
            vehicle.userData.gravityFactor = 0.2;
            vehicle.userData.rotationDamping = 0.99;
            vehicle.userData.freshlySpawned = true;
            vehicle.userData.stabilizationFactor = 0.98;
            
            // CRITICAL FIX: Create a specialized method for tracking this vehicle's state
            vehicle.checkCollisions = function() {
                if (this.collidable && typeof ObjectManager.checkObjectCollisions === 'function') {
                    return ObjectManager.checkObjectCollisions(this);
                }
                return [];
            };
            
            // Add to registry
            this.vehicles.push(vehicle);
            
        } catch (err) {
            console.error("Error setting up car components:", err);
        }
        
        return vehicle;
    }

    // NEW: Method to ensure vehicle is in a pushable state with enhanced impact response
    static ensureVehiclePushable(vehicle) {
        if (!vehicle || !vehicle.userData) return;
        
        // SIMPLIFIED: Just clear isStatic flag, remove hardFreeze reference
        vehicle.userData.isStatic = false;
        
        // Ensure velocity exists
        if (!vehicle.userData.velocity) {
            vehicle.userData.velocity = new Vector3(0, 0, 0);
        }
        
        // CRITICAL FIX: Check for recent impacts and ensure movement continues
        if (vehicle.userData.justImpacted && 
            vehicle.userData.impactTime && 
            Date.now() - vehicle.userData.impactTime < 5000) {
            
            // For recently impacted vehicles, ensure they remain unstabilized
            vehicle.userData.fullyStabilized = false;
            
            // If velocity is low but impact was recent, restore some momentum
            const speed = vehicle.userData.velocity.length();
            if (speed < 0.5 && vehicle.userData.impactDirection && vehicle.userData.impactSpeed > 0.5) {
                // Minimum speed is 20% of original impact speed
                const minSpeed = Math.max(0.5, vehicle.userData.impactSpeed * 0.2);
                vehicle.userData.velocity.copy(vehicle.userData.impactDirection).multiplyScalar(minSpeed);
                console.log(`RESTORED impact vehicle speed to ${minSpeed.toFixed(2)}`);
            }
            
            // Ensure the vehicle's speed property is updated
            if (vehicle.userData.speed !== undefined) {
                vehicle.userData.speed = vehicle.userData.velocity.length();
            }
            
            // Ensure these flags are all disabled
            vehicle.userData._controlledByCarController = false;
            vehicle.userData._heightManagedByController = false;
        }
        
        // Ensure physics will process this vehicle
        vehicle.userData._controlledByCarController = false;
        vehicle.userData._heightManagedByController = false;
        
        // If vehicle has been stationary for too long, reset additional properties
        const now = Date.now();
        const longStationaryPeriod = 10000; // 10 seconds
        
        if (vehicle.userData._lastMovedTime && 
            (now - vehicle.userData._lastMovedTime > longStationaryPeriod)) {
            console.log("Resetting long-stationary vehicle for mobility");
            vehicle.userData.fullyStabilized = false;
            vehicle.userData._needsPushability = true;
            
            // Reset any special state
            if (vehicle.userData.resetStateForPush) {
                vehicle.userData.resetStateForPush();
            }
        }
        
        // Mark vehicle as having been made pushable
        vehicle.userData._madeMovableSince = Date.now();
        
        return true;
    }

    // Update the current vehicle based on user input
    static updateCurrentVehicle(deltaTime = 1/60) {
        try {
            // Skip if no current vehicle
            if (!this.currentVehicle) {
                return;
            }
            
            // Ensure userData object exists
            if (!this.currentVehicle.userData) {
                this.currentVehicle.userData = {};
            }
            
            // Handle controller-managed vehicle
            const vehicleType = this.currentVehicle.userData.type;
            
            // For controller-managed vehicles, just update animations
            if (this.currentVehicle.userData?.isActivelyControlled || 
                this.currentVehicle.userData?._controlledByCarController) {
                // Controller is already handling this vehicle
                this.updateVehicleAnimations(this.currentVehicle, deltaTime);
            } else {
                // Update animations for non-controlled vehicles too
                this.updateVehicleAnimations(this.currentVehicle, deltaTime);
            }
            
            // Adjust height for non-falling vehicles
            if (!this.currentVehicle?.userData?.falling && this.currentVehicle?.userData?.planet) {
                Physics.maintainVehicleHeight(this.currentVehicle);
            }
            
            // CRITICAL FIX: Process all vehicles to ensure stationary ones can be pushed
            for (const vehicle of this.vehicles) {
                if (!vehicle || !vehicle.userData) continue;
                
                // Skip the current vehicle if player-controlled
                if (vehicle === this.currentVehicle && vehicle.userData?.isActivelyControlled) {
                    continue;
                }
                
                // Ensure velocity object exists
                if (!vehicle.userData.velocity) {
                    vehicle.userData.velocity = new Vector3(0, 0, 0);
                }
                
                // CRITICAL FIX: Special handling for recently impacted vehicles
                if (vehicle.userData?.justImpacted && 
                    vehicle.userData?.impactTime && 
                    Date.now() - vehicle.userData.impactTime < 5000) {
                
                    // SIMPLIFIED: Just clear isStatic flag, remove hardFreeze reference
                    vehicle.userData.isStatic = false;
                
                    // If velocity is low but impact was recent, restore some momentum
                    const speed = vehicle.userData.velocity.length();
                    if (speed < 0.5 && vehicle.userData.impactDirection && vehicle.userData.impactSpeed > 0.5) {
                        // Minimum speed is 20% of original impact speed
                        const minSpeed = Math.max(0.5, vehicle.userData.impactSpeed * 0.2);
                        vehicle.userData.velocity.copy(vehicle.userData.impactDirection).multiplyScalar(minSpeed);
                        console.log(`RESTORED impact vehicle speed to ${minSpeed.toFixed(2)}`);
                    }
                    
                    // Ensure the vehicle's speed property is updated
                    if (vehicle.userData.speed !== undefined) {
                        vehicle.userData.speed = vehicle.userData.velocity.length();
                    }
                    
                    // Ensure these flags are all disabled
                    vehicle.userData._controlledByCarController = false;
                    vehicle.userData._heightManagedByController = false;
                
                    // Check if impact period has expired
                    if (Date.now() - vehicle.userData.impactTime >= 5000) {
                        vehicle.userData.justImpacted = false;
                        console.log("Vehicle impact state cleared");
                    }
                }
            }
            
        } catch (err) {
            console.error("Error updating current vehicle:", err);
        }
    }
    
    // Update vehicle visual animations (wheels, propellers, etc.)
    static updateVehicleAnimations(vehicle, deltaTime) {
        if (!vehicle || !vehicle.userData) return;

        try {
            const vehicleType = vehicle.userData.type;
            const speed = vehicle.userData.speed || 0;
            
            if (vehicleType === 'car') {
                // Animate car wheels if they exist
                const wheels = vehicle.userData.wheels;
                if (wheels) {
                    // Calculate wheel rotation based on speed
                    // Average car wheel is ~0.6m radius, so full rotation at ~3.8m travel
                    const rotationSpeed = speed / 0.6; // radians per second
                    
                    if (!vehicle.userData.falling && Math.abs(speed) < 0.01) {
                        // When stationary, ensure wheels have the correct base orientation
                        this.resetWheelsBaseOrientation(vehicle);
                    } else {
                        // FIXED: Apply wheel rotation correctly considering steering angle
                        // For each wheel, we need to apply the rotation around its current axle direction
                        Object.entries(wheels).forEach(([wheelName, wheel]) => {
                            if (!wheel) return;
                            
                            // Skip animation if speed is too low
                            if (Math.abs(rotationSpeed) < 0.01) return;
                            
                            // SIMPLIFIED APPROACH: 
                            // 1. Calculate the angle to rotate
                            const rotationAngle = rotationSpeed * deltaTime;
                            
                            // 2. Create a rotation matrix around wheel's local X axis (axle)
                            // This is the key fix - using the wheel's current orientation to determine rotation axis
                            const axleDirection = new Vector3(1, 0, 0).applyQuaternion(wheel.quaternion);
                            
                            // 3. Apply rotation around this axle
                            wheel.rotateOnAxis(axleDirection.normalize(), rotationAngle);
                        });
                    }
                }
            } else if (vehicleType === 'airplane') {
                // Animate propeller if it exists
                const propeller = vehicle.userData.propeller;
                if (propeller) {
                    // Propeller rotation speed increases with airplane speed
                    const baseRotationSpeed = 5; // base rotation speed (radians per second)
                    const speedFactor = Math.abs(speed) / 10; // normalizes speed contribution
                    const rotationSpeed = baseRotationSpeed + speedFactor * 10;
                    
                    propeller.rotation.x += rotationSpeed * deltaTime;
                }
            }
        } catch (err) {
            console.error("Error updating vehicle animations:", err);
        }
    }
    
    // FIXED: Improved wheel orientation method that properly handles steering
    static resetWheelsBaseOrientation(vehicle) {
        if (!vehicle || !vehicle.userData || !vehicle.userData.wheels) return;
        
        try {
            // Skip wheel reorientation during hard freeze
            if (vehicle.userData.hardFreeze) return;
            
            // CRITICAL FIX: Skip wheel alignment for falling vehicles
            if (vehicle.userData.falling) return;
            
            // Check if car controller is actively managing this vehicle
            const isControllerManaged = vehicle === this.currentVehicle && 
                (vehicle.userData?.isActivelyControlled || vehicle.userData?._controlledByCarController);
                
            if (isControllerManaged) {
                // Let the controller handle wheel orientation
                return;
            }
            
            // Get steering angle from vehicle
            const steeringAngle = vehicle.userData.steeringAngle || 0;
            
            // Apply steering to front wheels, completely resetting rotation
            Object.entries(vehicle.userData.wheels).forEach(([wheelName, wheel]) => {
                if (!wheel) return;
                
                // CRITICAL FIX: Completely reset wheel rotation to avoid axis conflicts
                if (wheelName.includes('front')) {
                    // For front wheels, apply steering only
                    wheel.rotation.set(0, steeringAngle, Math.PI/2);
                    // Ensure quaternion is updated
                    wheel.quaternion.setFromEuler(wheel.rotation);
                } else {
                    // For rear wheels, maintain default orientation
                    wheel.rotation.set(0, 0, Math.PI/2);
                    // Ensure quaternion is updated
                    wheel.quaternion.setFromEuler(wheel.rotation);
                }
            });
            
            // Store that wheels have been properly oriented
            vehicle.userData.wheelsAligned = true;
            vehicle.userData.wheelAlignmentTime = Date.now();
            
        } catch (err) {
            console.error("Error resetting wheel orientation:", err);
        }
    }

    // Try to enter a nearby vehicle
    static tryEnterNearbyVehicle() {
        if (!PlayersManager.self) {
            console.log("No player available to enter vehicle");
            return false;
        }

        // Find the closest vehicle to the player
        const player = PlayersManager.self;
        const playerPosition = player.position || new Vector3();

        // CRITICAL FIX: Initialize a vehicle variable before using it
        let vehicle = null;
        let closestDistance = Infinity;

        // Find the closest vehicle
        for (const v of this.vehicles) {
            if (!v || !v.position) continue;
            if (v.userData && v.userData.isOccupied) continue; // Skip already occupied vehicles

            const distance = v.position.distanceTo(playerPosition);
            if (distance < closestDistance && distance < 5) { // Can enter within 5 units
                closestDistance = distance;
                vehicle = v;
            }
        }

        // CRITICAL FIX: Check if we found a vehicle before proceeding
        if (!vehicle) {
            console.log("No vehicles found nearby");
            return false;
        }

        console.log(`Found vehicle at distance ${closestDistance.toFixed(2)}, type: ${vehicle.userData?.type || 'unknown'}`);

        // Make sure player isn't already in a vehicle
        if (PlayersManager.self.inVehicle || this.currentVehicle) {
            console.log("Player is already in a vehicle");
            return false;
        }

        // CRITICAL FIX: Ensure vehicle is properly aligned to planet surface before entering
        if (vehicle.userData && vehicle.userData.planet) {
            const planet = vehicle.userData.planet;
            const planetCenter = planet.object.position;
            const toSurface = vehicle.position.clone().sub(planetCenter).normalize();
            
            console.log("Aligning vehicle to surface before player entry");
            
            // Use strong alignment factor for immediate correction
            // This single call replaces both alignment and snap functionality
            this.alignVehicleToPlanetSurface(vehicle, toSurface, 0.8, true);
        }

        // Set cross-references
        vehicle.userData.isOccupied = true;
        vehicle.userData.player = PlayersManager.self;
        
        // ENHANCED: Set more explicit player-vehicle relationship for collision system
        vehicle.userData.occupiedBy = PlayersManager.self.handle;
        vehicle.userData.currentDriver = PlayersManager.self;
        
        // CRITICAL FIX: Add flag to ignore collision between player and vehicle
        vehicle._ignoreCollisionWith = PlayersManager.self.handle;
        if (PlayersManager.self.handle) {
            PlayersManager.self.handle._ignoreCollisionWith = vehicle;
            
            // ADDED: Explicitly disable player collisions when entering vehicle
            // Hide player mesh and disable collision processing
            PlayersManager.setPlayerVisibility(PlayersManager.self, false);
            
            // Additional safety check - disable collision box
            if (PlayersManager.self.collidable) {
                PlayersManager.self.collidable.active = false;
                console.log("Player collision box explicitly disabled on vehicle entry");
            }
            
            // Add custom property to help debug collision issues
            PlayersManager.self.handle.userData._inVehicleTime = Date.now();
            PlayersManager.self.handle.userData._ignoreCollisionSince = Date.now();
        }

        // Update player state
        PlayersManager.self.inVehicle = true;
        PlayersManager.self.currentVehicle = vehicle;

        // Update global vehicle reference
        this.currentVehicle = vehicle;

        // Mark vehicle active for player controls
        vehicle.userData.hasInput = true;

        // Reset any velocity the player had
        if (PlayersManager.self.velocity) PlayersManager.self.velocity.set(0, 0, 0);

        console.log(`Player entered ${vehicle.userData?.type || 'unknown'} vehicle`);
        return true;
    }

    // Exit the current vehicle
    static exitVehicle() {
        if (!this.currentVehicle || !PlayersManager.self) {
            console.warn("Cannot exit vehicle - no current vehicle or player");
            return false;
        }
        
        try {
            const vehicle = this.currentVehicle;
            
            // ADDED: Only reset steering for car-type vehicles (minimal approach)
            if (vehicle.userData && vehicle.userData.type === 'car' && 
                typeof CarController !== 'undefined') {
                // Reset steering angle
                if (typeof CarController.steeringAngle !== 'undefined') {
                    CarController.steeringAngle = 0;
                }
                // Reset stored steering angle
                if (vehicle.userData.steeringAngle) {
                    vehicle.userData.steeringAngle = 0;
                }
                // Reset wheel orientation to neutral
                if (vehicle.userData.wheels && typeof CarController.updateWheelOrientation === 'function') {
                    CarController.updateWheelOrientation(vehicle, 0);
                }
            }
            
            // Clear cross-references
            vehicle.userData.isOccupied = false;
            vehicle.userData.player = null;
            vehicle.userData.occupiedBy = null;
            vehicle.userData.currentDriver = null;
            vehicle.userData.hasInput = false;
            
            // Update player state
            PlayersManager.self.inVehicle = false;
            PlayersManager.self.currentVehicle = null;
            
            // Position player next to vehicle
            const playerExitOffset = 3; // Units away from vehicle
            if (vehicle.userData.surfaceNormal && PlayersManager.self.position) {
                const exitDirection = new Vector3().crossVectors(
                    vehicle.userData.surfaceNormal, 
                    new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion)
                ).normalize();
                
                PlayersManager.self.position.copy(vehicle.position)
                    .addScaledVector(exitDirection, playerExitOffset)
                    .addScaledVector(vehicle.userData.surfaceNormal, 1); // Slightly higher
                
                if (PlayersManager.self.handle) {
                    PlayersManager.self.handle.position.copy(PlayersManager.self.position);
                    PlayersManager.self.handle.visible = true;
                    PlayersManager.self.handle.traverse(child => {
                        if (child !== PlayersManager.self.handle) {
                            child.visible = true;
                        }
                    });
                }
            }
            
            // Remove ignore flag
            if (PlayersManager.self.handle) {
                PlayersManager.self.handle._ignoreCollisionWith = null;
            }
            if (vehicle._ignoreCollisionWith === PlayersManager.self.handle) {
                vehicle._ignoreCollisionWith = null;
            }
            
            // Update global vehicle reference
            this.currentVehicle = null;
            
            // Mark car controller is no longer managing this vehicle
            vehicle.userData._controlledByCarController = false;
            vehicle.userData._heightManagedByController = false;
            
            console.log(`Player exited ${vehicle.userData?.type || 'unknown'} vehicle`);
            return true;
        } catch (err) {
            console.error("Error exiting vehicle:", err);
            return false;
        }
    }
    
    // NEW: Special processing for vehicles that have been recently impacted
    static processImpactedVehicle(vehicle) {
        if (!vehicle || !vehicle.userData || !vehicle.userData.justImpacted) return;
        
        try {
            // SIMPLIFIED: Just clear isStatic flag, remove hardFreeze reference
            vehicle.userData.isStatic = false;
            
            // Check if impact period has expired
            if (Date.now() - vehicle.userData.impactTime >= 5000) {
                // Impact period over - clear flag
                vehicle.userData.justImpacted = false;
                console.log("Impact period ended for vehicle");
            }
        } catch (err) {
            console.error("Error processing impacted vehicle:", err);
        }
    }
    
    // Set up vehicle interaction systems - called from SceneManager.setup
    static setupVehicleInteractions() {
        try {
            console.log("Setting up vehicle interaction systems");
            
            // Set up regular proximity checking for vehicles
            if (typeof window !== 'undefined') {
                // Check for nearby vehicles every 500ms
                if (this._proximityInterval) {
                    clearInterval(this._proximityInterval);
                }
                
                this._proximityInterval = setInterval(() => {
                    if (PlayersManager.self && !PlayersManager.self.inVehicle) {
                        const nearbyVehicle = this.checkVehicleProximity(PlayersManager.self);
                        
                        // Update UI prompt if needed
                        if (nearbyVehicle && typeof window.gameNotify === 'function') {
                            const vehicleType = nearbyVehicle.userData?.type || 'vehicle';
                            if (!this._lastProximityNotify || Date.now() - this._lastProximityNotify > 5000) {
                                window.gameNotify(`Press E to enter ${vehicleType}`);
                                this._lastProximityNotify = Date.now();
                            }
                        }
                    }
                }, 500);
            }
            
            // REMOVED: Duplicate key listener for vehicle entry/exit
            // The ControlManager already handles E key presses correctly
            
            return true;
        } catch (err) {
            console.error("Error setting up vehicle interactions:", err);
            return false;
        }
    }

    // Check for vehicles in proximity to the player
    static checkVehicleProximity(player) {
        if (!player || !player.position) return null;
        
        let closestVehicle = null;
        let closestDistance = 5; // Maximum interaction distance (5 units)
        
        for (const vehicle of this.vehicles) {
            if (!vehicle || !vehicle.position) continue;
            if (vehicle.userData && vehicle.userData.isOccupied) continue; // Skip already occupied vehicles
            
            const distance = vehicle.position.distanceTo(player.position);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestVehicle = vehicle;
            }
        }
        
        return closestVehicle;
    }
}