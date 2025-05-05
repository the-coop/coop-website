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

export default class VehicleManager {
    // Array of all vehicles in the scene
    static vehicles = [];
    static currentVehicle = null;
    
    // Add interaction cooldown timer
    static interactionCooldown = 0;

    // Improve vehicle positioning and prevent bouncing
    static alignVehicleToPlanetSurface(vehicle, surfaceNormal, lerpFactor = 0.1, forceFullAlignment = false) {
        if (!vehicle || !surfaceNormal) return;
        
        try {
            // CRITICAL FIX: Skip alignment entirely for falling vehicles unless forceFullAlignment is true
            // This allows vehicles to tumble naturally under gravity
            if (vehicle.userData && vehicle.userData.falling && !forceFullAlignment) return;
            
            // CRITICAL FIX: For cars, check if this is the currently driven car
            const isActiveCar = vehicle.userData && 
                               vehicle.userData.type === 'car' && 
                               vehicle === VehicleManager.currentVehicle && 
                               vehicle.userData.isActivelyControlled;
                               
            // Create alignment matrix that orients the vehicle to the planet surface
            // where 'up' vector is along the surface normal
            const defaultUp = new Vector3(0, 1, 0);
            
            // Calculate quaternion to rotate from default up to surface normal
            const alignmentQuaternion = new Quaternion();
            
            // Find axis perpendicular to both default up and surface normal
            const rotationAxis = new Vector3().crossVectors(defaultUp, surfaceNormal);
            
            // If rotation axis is too small (normal is parallel to up), use a default axis
            if (rotationAxis.lengthSq() < 0.001) {
                // Either exactly aligned or exactly opposite
                if (defaultUp.dot(surfaceNormal) < 0) {
                    // Upside down - use X axis for rotation
                    alignmentQuaternion.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI);
                }
                // Else identity quaternion (already aligned)
            } else {
                // Normalize rotation axis
                rotationAxis.normalize();
                
                // Calculate angle between default up and surface normal
                const angle = Math.acos(Math.min(1, Math.max(-1, defaultUp.dot(surfaceNormal))));
                
                // Set quaternion from axis and angle
                alignmentQuaternion.setFromAxisAngle(rotationAxis, angle);
            }
            
            // CRITICAL FIX: For actively controlled cars, preserve steering direction
            if (isActiveCar) {
                // Get the current forward direction in world space
                const currentForward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
                
                // Project this onto the tangent plane of the surface
                const projectedForward = currentForward.clone().projectOnPlane(surfaceNormal).normalize();
                
                // Only if projection is valid
                if (projectedForward.lengthSq() > 0.001) {
                    // Find right vector by taking cross product of up and forward
                    const rightVector = new Vector3().crossVectors(surfaceNormal, projectedForward).normalize();
                    
                    // Recalculate forward to ensure orthogonality
                    const correctedForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
                    
                    // Create rotation matrix from these orthogonal vectors
                    const m = new Matrix4();
                    m.makeBasis(rightVector, surfaceNormal, correctedForward);
                    
                    // Convert to quaternion
                    const newQuaternion = new Quaternion().setFromRotationMatrix(m);
                    
                    // Use this alignment instead
                    alignmentQuaternion.copy(newQuaternion);
                }
                
                // Use much smaller lerp factor for smoother steering
                lerpFactor = Math.min(lerpFactor, 0.03);
            }
            
            // IMPROVED: Track previous quaternion for smooth transitions
            if (!vehicle.userData.lastAlignmentQuaternion) {
                vehicle.userData.lastAlignmentQuaternion = new Quaternion();
                vehicle.userData.lastAlignmentQuaternion.copy(vehicle.quaternion);
            }
            
            // CRITICAL FIX: Different alignment strategies for different states
            let finalLerpFactor = lerpFactor;
            
            if (forceFullAlignment) {
                // Use stronger factor for immediate alignment (landing)
                finalLerpFactor = Math.min(0.8, lerpFactor * 4);
            }
            else if (vehicle.userData.hardFreeze || vehicle.userData.justLanded) {
                // Strong factor for stabilization right after landing
                finalLerpFactor = Math.min(0.5, lerpFactor * 3);
            }
            else if (vehicle.userData.fullyStabilized) {
                // Very gentle factor for stabilized vehicles
                finalLerpFactor = Math.min(0.01, lerpFactor * 0.2);
            }
            
            // Apply the final rotation with calculated lerp factor
            vehicle.quaternion.slerp(alignmentQuaternion, finalLerpFactor);
            
            // ADDED: Store last alignment quaternion for reference
            vehicle.userData.lastAlignmentQuaternion.copy(vehicle.quaternion);
            
            // IMPROVED: Store when this alignment happened for debugging and state tracking
            vehicle.userData._lastAlignmentTime = Date.now();
            vehicle.userData._lastVehicleManagerAlignTime = Date.now();
            
            // CRITICAL FIX: Dampen any existing angular velocity to reduce spinning
            if (vehicle.userData.angularVelocity) {
                const dampFactor = isActiveCar ? 0.7 : 0.9;
                vehicle.userData.angularVelocity.multiplyScalar(1 - dampFactor);
                
                // Kill very small angular velocities completely
                if (vehicle.userData.angularVelocity.lengthSq() < 0.0001) {
                    vehicle.userData.angularVelocity.set(0, 0, 0);
                }
            }
        } catch (err) {
            console.error("Error aligning vehicle to surface:", err);
        }
    }

    // Create a car on the specified planet at the given coordinates
    static createCarOnSurface(planet, latitude, longitude, heightOffset = 3) {
        try {
            console.log(`Creating car on planet ${planet.name} at lat=${latitude}, lon=${longitude}, height=${heightOffset}`);
            
            // FIXED: Use lower height offset for better stability on spawn
            const adjustedHeightOffset = heightOffset || 10; // Reduced from 50
            const car = this.createVehicleBase('car', planet, latitude, longitude, adjustedHeightOffset);
            
            if (!car) {
                console.error("Failed to create vehicle base object");
                return null;
            }
            
            // Add a vehicle name
            car.userData.name = `Car-${Math.floor(Math.random() * 1000)}`;
            
            // Create car body - REDUCED SIZE to better match player scale
            const bodyGeometry = new BoxGeometry(3, 1.5, 5);        
            const bodyMaterial = new MeshBasicMaterial({ color: 0xFF0000 });
            const body = new Mesh(bodyGeometry, bodyMaterial);
            body.position.y = -0.5;        
            car.add(body);
            
            // Create wheels collection for animation
            car.userData.wheels = {};
            
            // Further reduced wheel size to be proportionate with smaller car
            const wheelGeometry = new CylinderGeometry(0.6, 0.6, 0.5, 16);        
            const wheelMaterial = new MeshBasicMaterial({ 
                color: 0x111111, 
                transparent: false,
                wireframe: false
            });
            
            // FIXED: Position wheels properly on sides AND touching ground
            const wheelFL = new Mesh(wheelGeometry, wheelMaterial);
            wheelFL.position.set(-1.7, -1.4, 1.8);        
            wheelFL.rotation.z = Math.PI / 2;
            wheelFL.rotation.y = 0;
            car.add(wheelFL);
            car.userData.wheels.frontLeft = wheelFL;
            
            // Front right wheel
            const wheelFR = new Mesh(wheelGeometry, wheelMaterial);
            wheelFR.position.set(1.7, -1.4, 1.8);        
            wheelFR.rotation.z = Math.PI / 2;
            wheelFR.rotation.y = 0;
            car.add(wheelFR);
            car.userData.wheels.frontRight = wheelFR;
            
            // Rear left wheel
            const wheelRL = new Mesh(wheelGeometry, wheelMaterial);
            wheelRL.position.set(-1.7, -1.4, -1.8);        
            wheelRL.rotation.z = Math.PI / 2;
            wheelRL.rotation.y = 0;
            car.add(wheelRL);
            car.userData.wheels.rearLeft = wheelRL;
            
            // Rear right wheel
            const wheelRR = new Mesh(wheelGeometry, wheelMaterial);
            wheelRR.position.set(1.7, -1.4, -1.8);        
            wheelRR.rotation.z = Math.PI / 2;
            wheelRR.rotation.y = 0;
            car.add(wheelRR);
            car.userData.wheels.rearRight = wheelRR;
            
            // Add windshield
            const windshieldGeometry = new BoxGeometry(2.8, 0.8, 0.1);
            const windshieldMaterial = new MeshBasicMaterial({ 
                color: 0x88CCFF, 
                transparent: true,
                opacity: 0.7
            });
            const windshield = new Mesh(windshieldGeometry, windshieldMaterial);
            windshield.position.set(0, 0.2, 0.7);
            windshield.rotation.x = Math.PI / 6; // Angled windshield
            car.add(windshield);
            
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
            
            // FIXED: Lower car speed and adjust physics properties for better handling
            vehicle.userData.mass = 1000; 
            vehicle.userData.velocity = new Vector3(0, 0, 0);
            vehicle.userData.falling = true;
            vehicle.userData.speed = 0;
            vehicle.userData.maxSpeed = 12; // Reduced from 20
            vehicle.userData.acceleration = 0;
            vehicle.userData.drag = 0.08; // Increased from 0.05
            vehicle.userData.bounceFactor = 0.01;
            vehicle.userData.landingDamping = 0.98;
            
            // CRITICAL FIX: Increase fixed height offset to prevent clipping into planet
            vehicle.userData.fixedHeightOffset = 3.0;
            
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
            
            console.log(`Creating ${type} at lat=${latitude}, lon=${longitude}, height=${heightOffset}`);
            
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
            
            // IMPROVED: For high altitude spawns, log detailed info
            if (heightOffset > 1000) {
                console.log(`Creating high-altitude ${type} above ${planet.name} with height=${heightOffset}`);
            }
            
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
            body.position.y = -0.5;        
            vehicle.add(body);
            
            // Create wheels collection for animation
            vehicle.userData.wheels = {};
            
            const wheelGeometry = new CylinderGeometry(0.6, 0.6, 0.5, 16);        
            const wheelMaterial = new MeshBasicMaterial({ 
                color: 0x111111, 
                transparent: false,
                wireframe: false
            });
            
            // Position wheels
            const wheelFL = new Mesh(wheelGeometry, wheelMaterial);
            wheelFL.position.set(-1.7, -1.4, 1.8);        
            wheelFL.rotation.z = Math.PI / 2;
            wheelFL.rotation.y = 0;
            vehicle.add(wheelFL);
            vehicle.userData.wheels.frontLeft = wheelFL;
            
            // Front right wheel
            const wheelFR = new Mesh(wheelGeometry, wheelMaterial);
            wheelFR.position.set(1.7, -1.4, 1.8);        
            wheelFR.rotation.z = Math.PI / 2;
            wheelFR.rotation.y = 0;
            vehicle.add(wheelFR);
            vehicle.userData.wheels.frontRight = wheelFR;
            
            // Rear left wheel
            const wheelRL = new Mesh(wheelGeometry, wheelMaterial);
            wheelRL.position.set(-1.7, -1.4, -1.8);        
            wheelRL.rotation.z = Math.PI / 2;
            wheelRL.rotation.y = 0;
            vehicle.add(wheelRL);
            vehicle.userData.wheels.rearLeft = wheelRL;
            
            // Rear right wheel
            const wheelRR = new Mesh(wheelGeometry, wheelMaterial);
            wheelRR.position.set(1.7, -1.4, -1.8);        
            wheelRR.rotation.z = Math.PI / 2;
            wheelRR.rotation.y = 0;
            vehicle.add(wheelRR);
            vehicle.userData.wheels.rearRight = wheelRR;
            
            // Add windshield
            const windshieldGeometry = new BoxGeometry(2.8, 0.8, 0.1);
            const windshieldMaterial = new MeshBasicMaterial({ 
                color: 0x88CCFF, 
                transparent: true,
                opacity: 0.7
            });
            const windshield = new Mesh(windshieldGeometry, windshieldMaterial);
            windshield.position.set(0, 0.2, 0.7);
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
            
            // FIXED: Lower car speed and adjust physics properties for better handling
            vehicle.userData.mass = 1000; 
            vehicle.userData.velocity = new Vector3(0, 0, 0);
            vehicle.userData.falling = true;
            vehicle.userData.speed = 0;
            vehicle.userData.maxSpeed = 12; // Reduced from 20
            vehicle.userData.acceleration = 0;
            vehicle.userData.drag = 0.08; // Increased from 0.05
            vehicle.userData.bounceFactor = 0.01;
            vehicle.userData.landingDamping = 0.98;
            
            // CRITICAL FIX: Increase fixed height offset to prevent clipping into planet
            vehicle.userData.fixedHeightOffset = 3.0;
            
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

    // Validation method to check for and fix "ghost" vehicles
    static validateVehicles() {
        try {
            // Track validation results for debugging
            const validationResults = {
                total: this.vehicles.length,
                valid: 0,
                removed: 0,
                fixed: 0
            };
            
            // First check if currentVehicle exists in the vehicles array
            if (this.currentVehicle) {
                const isCurrentInArray = this.vehicles.includes(this.currentVehicle);
                
                if (!isCurrentInArray) {
                    console.warn("Current vehicle not found in vehicles array - fixing reference");
                    this.currentVehicle = null;
                    validationResults.fixed++;
                }
            }
            
            // Filter out invalid vehicles and keep valid ones
            this.vehicles = this.vehicles.filter(vehicle => {
                // Skip null or undefined vehicles
                if (!vehicle) {
                    validationResults.removed++;
                    return false;
                }
                
                // Check for missing critical properties
                if (!vehicle.position || !vehicle.userData) {
                    console.warn("Removing invalid vehicle missing position or userData");
                    validationResults.removed++;
                    return false;
                }
                
                // Check for NaN positions
                if (isNaN(vehicle.position.x) || isNaN(vehicle.position.y) || isNaN(vehicle.position.z)) {
                    console.warn("Removing vehicle with invalid position:", vehicle.userData.name || "unnamed");
                    validationResults.removed++;
                    return false;
                }
                
                // Check for missing collision data
                if (!vehicle.collidable) {
                    console.log("Vehicle missing collision data - attempting fix");
                    
                    // Try to re-register with collision system
                    const dimensions = {
                        width: vehicle.userData.width || 3,
                        height: vehicle.userData.height || 1.5,
                        depth: vehicle.userData.depth || 5
                    };
                    
                    // Re-register with collision system
                    if (window.ObjectManager) {
                        vehicle.collidable = window.ObjectManager.registerGameObject(
                            vehicle, 
                            'vehicle', 
                            dimensions, 
                            false
                        );
                        validationResults.fixed++;
                    }
                }
                
                // Ensure velocity property exists to prevent errors
                if (!vehicle.userData.velocity) {
                    vehicle.userData.velocity = new Vector3(0, 0, 0);
                    validationResults.fixed++;
                }
                
                // The vehicle passed all checks or was fixed
                validationResults.valid++;
                return true;
            });
            
            // Extra validation for current vehicle
            if (this.currentVehicle) {
                // Make sure isOccupied flag is set
                if (!this.currentVehicle.userData.isOccupied) {
                    this.currentVehicle.userData.isOccupied = true;
                    validationResults.fixed++;
                }
                
                // Make sure type is set
                if (!this.currentVehicle.userData.type) {
                    // Default to car if type is missing
                    this.currentVehicle.userData.type = 'car';
                    validationResults.fixed++;
                }
            }
            
            // Log results if changes were made
            if (validationResults.removed > 0 || validationResults.fixed > 0) {
                console.log("Vehicle validation results:", validationResults);
            }
            
            return validationResults;
        } catch (err) {
            console.error("Error validating vehicles:", err);
            return {
                error: true,
                message: err.message
            };
        }
    }
    
    // Update the current vehicle based on user input, but leave physics to Physics class
    static updateCurrentVehicle(deltaTime = 1/60) {
        try {
            // Skip if there is no current vehicle
            if (!this.currentVehicle) {
                return;
            }
            
            // Ensure userData object exists
            if (!this.currentVehicle.userData) {
                this.currentVehicle.userData = {};
            }
            
            // Handle vehicle-specific updates - but ONLY input processing, not physics
            const vehicleType = this.currentVehicle.userData.type;
            
            if (vehicleType === 'car') {
                this.handleCarInput(this.currentVehicle, deltaTime);
            } else if (vehicleType === 'airplane') {
                this.handleAirplaneInput(this.currentVehicle, deltaTime);
            }
            
            // Update camera position if needed
            if (this.currentVehicle.userData._lockCamera && 
                this.currentVehicle.userData._cameraPosition && 
                window.Engine && window.Engine.camera) {
                
                // Ensure camera stays at the fixed position relative to vehicle
                window.Engine.camera.position.copy(this.currentVehicle.userData._cameraPosition);
                
                // Ensure camera maintains the fixed rotation
                if (this.currentVehicle.userData._cameraRotation) {
                    window.Engine.camera.rotation.copy(this.currentVehicle.userData._cameraRotation);
                }
            }
            
            // Update any visual effects or animations
            this.updateVehicleAnimations(this.currentVehicle, deltaTime);
            
        } catch (err) {
            console.error("Error updating current vehicle:", err);
        }
    }
    
    // NEW: Car input handling separate from physics
    static handleCarInput(car, deltaTime) {
        // Skip for player-controlled vehicles - let CarController handle it
        if (car === this.currentVehicle && car.userData?.isActivelyControlled) {
            return;
        }
        
        // Get input state from ControlManager
        const input = ControlManager.getVehicleInput();
        if (!input) return;
        
        // FIXED: Reduce acceleration rates for smoother driving
        if (input.accelerate) {
            car.userData.acceleration += 0.025; // Reduced from 0.05
        } else if (input.brake) {
            car.userData.acceleration -= 0.05; // Reduced from 0.1
        } else {
            car.userData.acceleration *= 0.9; // Gradual decrease
        }
        
        // Clamp acceleration
        car.userData.acceleration = Math.max(-0.3, Math.min(0.3, car.userData.acceleration));
        
        // Update speed based on acceleration
        car.userData.speed += car.userData.acceleration;
        
        // Apply drag
        car.userData.speed *= (1 - car.userData.drag);
        
        // FIXED: Lower maximum speed
        const maxSpeed = car.userData.maxSpeed || 12; // Default to 12 if not set
        
        // Clamp speed
        car.userData.speed = Math.max(-maxSpeed/2, Math.min(maxSpeed, car.userData.speed));
        
        // ENHANCED: Handle steering with wheel updates
        if (input.turnLeft) {
            // Update steering angle gradually
            const steeringDelta = 0.05;
            car.userData.steeringAngle = Math.min(0.4, (car.userData.steeringAngle || 0) + steeringDelta);
            this.resetWheelsBaseOrientation(car);
            
            // Rotate car body when moving
            if (Math.abs(car.userData.speed) > 0.1) {
                const turnFactor = 0.015 * Math.min(1, Math.abs(car.userData.speed) / 10);
                car.rotation.y += turnFactor;
            }
        } else if (input.turnRight) {
            // Update steering angle gradually
            const steeringDelta = 0.05;
            car.userData.steeringAngle = Math.max(-0.4, (car.userData.steeringAngle || 0) - steeringDelta);
            this.resetWheelsBaseOrientation(car);
            
            // Rotate car body when moving
            if (Math.abs(car.userData.speed) > 0.1) {
                const turnFactor = 0.015 * Math.min(1, Math.abs(car.userData.speed) / 10);
                car.rotation.y -= turnFactor;
            }
        } else {
            // Return steering to center gradually
            if (car.userData.steeringAngle) {
                car.userData.steeringAngle *= 0.9;
                if (Math.abs(car.userData.steeringAngle) < 0.01) {
                    car.userData.steeringAngle = 0;
                }
                this.resetWheelsBaseOrientation(car);
            }
        }
        
        // ENHANCED: Calculate surface-aligned velocity for non-falling cars
        if (!car.userData.falling && car.userData.planet && car.userData.planet.object) {
            // Get planet information for surface alignment
            const planetCenter = car.userData.planet.object.position;
            const toVehicle = car.position.clone().sub(planetCenter).normalize();
            
            // Calculate forward direction based on car rotation
            const forward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Project forward direction onto planet surface tangent plane
            const surfaceForward = forward.clone().projectOnPlane(toVehicle).normalize();
            
            // Set velocity along the surface
            car.userData.velocity.copy(surfaceForward.multiplyScalar(car.userData.speed));
        } else {
            // Normal physics for falling
            const direction = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            car.userData.velocity.copy(direction.multiplyScalar(car.userData.speed));
        }
    }
    
    // NEW: Airplane input handling separate from physics
    static handleAirplaneInput(airplane, deltaTime) {
        // Handle thrust, pitch, roll, etc. - ONLY user input processing
        // All actual physics movement is handled by Physics class
        
        // Get input state from ControlManager
        const input = ControlManager.getVehicleInput();
        if (!input) return;
        
        // Process thrust
        if (input.accelerate) {
            airplane.userData.acceleration += 0.05;
        } else if (input.brake) {
            airplane.userData.acceleration -= 0.05;
        } else {
            airplane.userData.acceleration *= 0.95; // Gradual decrease
        }
        
        // Clamp acceleration
        airplane.userData.acceleration = Math.max(-0.3, Math.min(0.3, airplane.userData.acceleration));
        
        // Update speed based on acceleration
        airplane.userData.speed += airplane.userData.acceleration;
        
        // Apply drag
        airplane.userData.speed *= (1 - airplane.userData.drag);
        
        // Clamp speed
        airplane.userData.speed = Math.max(-airplane.userData.maxSpeed/3, 
                                     Math.min(airplane.userData.maxSpeed, airplane.userData.speed));
        
        // Handle flight controls
        if (input.turnLeft) {
            airplane.rotation.y += 0.015;
        } else if (input.turnRight) {
            airplane.rotation.y -= 0.015;
        }
        
        if (input.pitchUp) {
            airplane.rotation.x -= 0.01;
        } else if (input.pitchDown) {
            airplane.rotation.x += 0.01;
        }
        
        if (input.rollLeft) {
            airplane.rotation.z += 0.02;
        } else if (input.rollRight) {
            airplane.rotation.z -= 0.02;
        }
        
        // Calculate velocity vector from speed and orientation
        const direction = new Vector3(0, 0, -1).applyQuaternion(airplane.quaternion);
        airplane.userData.velocity.copy(direction.multiplyScalar(airplane.userData.speed));
        
        // Apply lift based on speed
        if (airplane.userData.lift && airplane.userData.speed > 5) {
            const lift = Math.min(airplane.userData.lift * airplane.userData.speed / 10, 0.2);
            const upVector = new Vector3(0, 1, 0).applyQuaternion(airplane.quaternion);
            airplane.userData.velocity.addScaledVector(upVector, lift);
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
                    
                    // ADDED: Ensure wheels have proper base orientation when not moving
                    if (Math.abs(speed) < 0.01 && !vehicle.userData.falling) {
                        // When stationary on the ground, ensure wheels have the correct base rotation
                        this.resetWheelsBaseOrientation(vehicle);
                    } else {
                        // Rotate each wheel based on vehicle movement
                        Object.values(wheels).forEach(wheel => {
                            if (wheel) {
                                wheel.rotation.x += rotationSpeed * deltaTime;
                            }
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
    
    // NEW: Helper method to enforce car staying on surface for active vehicles
    static enforceSurfaceContact(car) {
        try {
            if (!car || !car.userData.planet || !car.userData.planet.object) return;
            
            const planet = car.userData.planet;
            const planetCenter = planet.object.position;
            const toVehicle = car.position.clone().sub(planetCenter);
            const currentDistance = toVehicle.length();
            const idealDistance = planet.radius + car.userData.fixedHeightOffset;
            
            // Calculate how far off the ideal distance we are
            const distanceDifference = currentDistance - idealDistance;
            
            // If we're too far from surface (above), pull down stronger
            if (distanceDifference > 0.05) {
                // Apply a stronger force to keep on ground - more aggressive for player vehicles
                const correctionStrength = 0.3;
                const correctionAmount = distanceDifference * correctionStrength;
                
                // Move car closer to surface
                const newPosition = toVehicle.normalize().multiplyScalar(currentDistance - correctionAmount);
                car.position.copy(planetCenter).add(newPosition);
                
                // Zero out any upward velocity component
                if (car.userData.velocity) {
                    const upComponent = car.userData.velocity.dot(toVehicle.normalize());
                    if (upComponent > 0) {
                        const upVector = toVehicle.normalize().multiplyScalar(upComponent);
                        car.userData.velocity.sub(upVector);
                    }
                }
                
                // Update collision bounds after position change
                if (car.collidable && typeof ObjectManager?.updateCollidableBounds === 'function') {
                    ObjectManager.updateCollidableBounds(car);
                }
            }
        } catch (err) {
            console.error("Error enforcing surface contact:", err);
        }
    }
    
    // FIXED: Improved wheel orientation method that properly handles steering
    static resetWheelsBaseOrientation(vehicle) {
        if (!vehicle || !vehicle.userData || !vehicle.userData.wheels) return;
        
        try {
            // Skip wheel reorientation during hard freeze
            if (vehicle.userData.hardFreeze) return;
            
            // Skip if vehicle is actively controlled by CarController
            if (vehicle === this.currentVehicle && vehicle.userData?.isActivelyControlled) {
                return;
            }
            
            // Get steering angle from vehicle
            const steeringAngle = vehicle.userData.steeringAngle || 0;
            
            // Apply steering to front wheels, preserving roll rotation
            Object.entries(vehicle.userData.wheels).forEach(([wheelName, wheel]) => {
                if (!wheel) return;
                
                // Get current roll rotation (x-axis)
                const currentRoll = wheel.rotation.x;
                
                if (wheelName.includes('front')) {
                    // Apply steering to front wheels
                    wheel.rotation.set(
                        currentRoll,        // Keep current roll rotation
                        steeringAngle,      // Apply steering angle to y-axis
                        Math.PI/2           // Keep wheels perpendicular (z-axis)
                    );
                } else {
                    // Keep rear wheels straight
                    wheel.rotation.set(
                        currentRoll,        // Keep current roll rotation
                        0,                  // No steering for rear wheels
                        Math.PI/2           // Keep wheels perpendicular
                    );
                }
            });
            
            // Store that wheels have been properly oriented
            vehicle.userData.wheelsAligned = true;
            vehicle.userData.wheelAlignmentTime = Date.now();
            
        } catch (err) {
            console.error("Error resetting wheel orientation:", err);
        }
    }

    // Helper method to update car physics
    static updateCar(car, deltaTime) {
        if (!car || !car.userData) return;
        
        // Skip physics processing for player-controlled cars
        if (car === this.currentVehicle && car.userData?.isActivelyControlled) {
            // Let CarController handle all movement and alignment
            return;
        }
        
        try {
            // Skip physics for vehicles in hard freeze state
            if (car.userData.hardFreeze) {
                const now = Date.now();
                if (car.userData.hardFreezeEndTime && now < car.userData.hardFreezeEndTime) {
                    // During hard freeze, just maintain correct height and alignment
                    if (window.Physics && typeof window.Physics.maintainVehicleSurfaceHeight === 'function') {
                        window.Physics.maintainVehicleSurfaceHeight(car);
                    }
                    return; // Skip all other physics processing
                } else {
                    car.userData.hardFreeze = false;
                }
            }
            
            // ENHANCED: Skip all physics for fully stabilized non-moving cars
            // This prevents any physics forces from causing spinning
            if (car.userData.fullyStabilized && 
                Math.abs(car.userData.speed || 0) < 0.01 &&
                (!car.userData.velocity || car.userData.velocity.lengthSq() < 0.001)) {
                
                // When car is fully stabilized and not moving, disable all physics
                // and just maintain position using simple sphere collision
                if (window.Physics && typeof window.Physics.maintainVehicleSurfaceHeight === 'function') {
                    window.Physics.maintainVehicleSurfaceHeight(car, true); // Added true for enhanced adhesion
                }
                
                // Keep wheels properly aligned
                this.resetWheelsBaseOrientation(car);
                
                // ADDED: Completely disable complex collision for stationary vehicles
                // This prevents small forces from causing the vehicle to spin
                if (car.collidable) {
                    car.collidable.active = false; // Temporarily disable collision processing
                    
                    // Only re-enable collision detection if debug visualization is active
                    if (window.ObjectManager && window.ObjectManager._debugEnabled) {
                        car.collidable.active = true;
                        ObjectManager.updateCollidableBounds(car);
                    }
                }
                
                return; // Skip all other physics processing
            } else if (car.collidable) {
                // Re-enable collision for moving vehicles
                car.collidable.active = true;
                
                // IMPROVED: If this is a player-driven car, disable self-collision with the player
                if (car === this.currentVehicle && car.userData.isOccupied && 
                    car.userData.player && car.userData.player.handle) {
                    const playerHandle = car.userData.player.handle;
                    
                    // Establish two-way collision ignoring
                    if (car._ignoreCollisionWith !== playerHandle) {
                        car._ignoreCollisionWith = playerHandle;
                    }
                    
                    if (playerHandle._ignoreCollisionWith !== car) {
                        playerHandle._ignoreCollisionWith = car;
                    }
                    
                    // ADDED: Also ensure the player knows they're in a vehicle
                    if (!car.userData.player.inVehicle) {
                        car.userData.player.inVehicle = true;
                        car.userData.player.currentVehicle = car;
                    }
                }
            }
            
            // IMPROVED: Use gentler surface height maintenance to let physics work naturally
            if (window.Physics && typeof window.Physics.maintainVehicleSurfaceHeight === 'function') {
                // ADDED: Force vehicle to stick to surface like FPS controller when not falling
                const forceGroundAdhesion = !car.userData.falling && 
                                           (car === this.currentVehicle || !car.userData.enhancedStabilization);
                                           
                window.Physics.maintainVehicleSurfaceHeight(car, forceGroundAdhesion);
                
                // ENHANCED: If this is the active vehicle, enforce stronger ground contact
                if (car === this.currentVehicle && car.userData.isOccupied) {
                    this.enforceSurfaceContact(car);
                }
                
                // MODIFIED: Only perform alignment checks if not fully stabilized
                if (car.userData.planet && !car.userData.falling && 
                    !car.userData.fullyStabilized && !car.userData.enhancedStabilization) {
                    
                    const planet = car.userData.planet;
                    if (planet && planet.object) {
                        const toVehicle = car.position.clone().sub(planet.object.position).normalize();
                        
                        // Check if the vehicle is severely misaligned (nearly upside down)
                        const upVector = new Vector3(0, 1, 0).applyQuaternion(car.quaternion);
                        const alignmentDot = upVector.dot(toVehicle);
                        
                        if (Math.abs(alignmentDot) < 0.3) { // Only correct severe misalignment
                            // Apply minimal correction with very gentle factor
                            this.alignVehicleToPlanetSurface(car, toVehicle, 0.05);
                            
                            // Reset the fully stabilized flag since we had to make a correction
                            car.userData.fullyStabilized = false;
                            
                            // Make sure wheels are properly aligned if we had to re-adjust the car
                            this.resetWheelsBaseOrientation(car);
                        }
                    }
                }
                
                // ADDED: If car was falling but is now grounded, ensure wheels are properly aligned
                if (car.userData.justLanded) {
                    // Wait a short moment before aligning wheels to let the vehicle settle
                    setTimeout(() => {
                        if (car && car.userData) {
                            this.resetWheelsBaseOrientation(car);
                            car.userData.justLanded = false;
                            
                            // ADDED: After landing, force the car to adhere to the surface
                            car.userData._needsGroundAdhesion = true;
                            car.userData._groundAdhesionTime = Date.now();
                            
                            // Apply small damping to velocity to avoid bouncing
                            if (car.userData.velocity) {
                                car.userData.velocity.multiplyScalar(0.8);
                            }
                        }
                    }, 100);
                }
                
                // ADDED: Apply extra adhesion for recently landed vehicles
                if (car.userData._needsGroundAdhesion && car.userData._groundAdhesionTime) {
                    const timeSinceLanding = Date.now() - car.userData._groundAdhesionTime;
                    if (timeSinceLanding < 3000) { // Apply for 3 seconds after landing
                        // Force position maintenance to keep car firmly on ground
                        if (car.userData.planet && car.userData.planet.object) {
                            const planetCenter = car.userData.planet.object.position;
                            const toVehicle = car.position.clone().sub(planetCenter);
                            const currentDistance = toVehicle.length();
                            const planetRadius = car.userData.planet.radius;
                            const idealDistance = planetRadius + (car.userData.fixedHeightOffset || 3.0);
                            
                            // If too high above surface, pull down
                            if (currentDistance > idealDistance + 0.1) {
                                const correctionFactor = 0.2; // Strength of correction
                                const newDistance = currentDistance - 
                                                   ((currentDistance - idealDistance) * correctionFactor);
                                const newPosition = toVehicle.normalize().multiplyScalar(newDistance);
                                car.position.copy(planetCenter).add(newPosition);
                            }
                            
                            // Dampen any upward velocity component
                            if (car.userData.velocity) {
                                const normalComponent = car.userData.velocity.dot(toVehicle.normalize());
                                if (normalComponent > 0) { // If moving away from planet
                                    // Remove upward component
                                    const reduction = 0.7; // Remove 70% of upward velocity
                                    const normalVelocity = toVehicle.normalize().multiplyScalar(normalComponent);
                                    car.userData.velocity.sub(normalVelocity.multiplyScalar(reduction));
                                }
                            }
                        }
                    } else {
                        // After 3 seconds, disable extra adhesion
                        car.userData._needsGroundAdhesion = false;
                    }
                }
            }
        } catch (err) {
            console.error("Error updating car:", err);
        }
    }

    // Find a safe spawn position that doesn't overlap with other vehicles
    static findSafeSpawnPosition(basePosition, minDistance = 5) {
        // Scan existing vehicles for overlap
        for (const v of this.vehicles) {
            const distance = v.position.distanceTo(basePosition);
            if (distance < minDistance) {
                // Shift position slightly
                basePosition.x += (minDistance - distance);
                basePosition.z += (minDistance - distance);
            }
        }
        return basePosition;
    }

    // Try to enter a nearby vehicle
    static tryEnterNearbyVehicle() {
        if (!PlayersManager.self) return false;
        
        // Find the closest vehicle within interaction range
        let closestVehicle = null;
        let closestDistance = 21; // INCREASED: From 20 to 21 units for safer interaction
        
        console.log(`Looking for vehicles within ${closestDistance} units of player...`);
        
        // Debug all vehicles and their distances
        let vehicleCount = 0;
        let occupiedCount = 0;
        let outOfRangeCount = 0;
        let validCandidates = 0;
        
        for (const vehicle of this.vehicles) {
            // Skip occupied vehicles with clear message
            if (vehicle.userData && vehicle.userData.isOccupied) {
                console.log(`Vehicle ${vehicle.name || 'unnamed'} is already occupied - skipping`);
                occupiedCount++;
                continue;
            }
            
            const distance = PlayersManager.self.position.distanceTo(vehicle.position);
            console.log(`Vehicle ${vehicle.name || 'unnamed'} (${vehicle.userData?.type || 'unknown type'}) at distance ${distance.toFixed(2)}`);
            
            // FIXED: Changed from < to <= to include vehicles exactly at the boundary
            if (distance <= closestDistance) {
                closestDistance = distance;
                closestVehicle = vehicle;
                validCandidates++;
            } else {
                outOfRangeCount++;
            }
        }
        
        // IMPROVED: Better debug information about vehicle selection process
        console.log(`Found ${vehicleCount} vehicles total: ${occupiedCount} occupied, ${outOfRangeCount} out of range, ${validCandidates} valid candidates`);
        console.log(`Closest vehicle distance: ${closestDistance.toFixed(2)} (interaction limit: ${closestDistance})`);
        
        // If a vehicle is found, enter it
        if (closestVehicle) {
            console.log(`Entering vehicle: ${closestVehicle.name || 'unnamed'} (${closestVehicle.userData?.type || 'unknown type'})`);
            
            // IMPORTANT: Update vehicle state FIRST
            this.currentVehicle = closestVehicle;
            this.currentVehicle.userData.isOccupied = true;
            this.currentVehicle.userData.player = PlayersManager.self;
            this.currentVehicle.userData.hasPlayerInside = true;
            
            // Update player state
            PlayersManager.self.inVehicle = true;
            PlayersManager.self.currentVehicle = this.currentVehicle;
            
            // CRITICAL FIX: Set proper collision ignoring
            if (PlayersManager.self.handle) {
                this.currentVehicle._ignoreCollisionWith = PlayersManager.self.handle;
                PlayersManager.self.handle._ignoreCollisionWith = this.currentVehicle;
                console.log("Set up collision ignoring between player and vehicle");
                
                // ADDED: Hide player mesh when entering vehicle
                PlayersManager.setPlayerVisibility(PlayersManager.self, false);
            }
            
            // ADDED: Ensure vehicle is properly aligned before transition
            if (this.currentVehicle.userData.planet && this.currentVehicle.userData.planet.object) {
                const planet = this.currentVehicle.userData.planet;
                const toVehicle = this.currentVehicle.position.clone()
                    .sub(planet.object.position).normalize();
                
                // Apply initial alignment
                this.alignVehicleToPlanetSurface(this.currentVehicle, toVehicle, 0.5, true);
                this.resetWheelsBaseOrientation(this.currentVehicle);
                
                // Ensure the vehicle stays grounded
                this.currentVehicle.userData._needsGroundAdhesion = true;
                this.currentVehicle.userData._groundAdhesionTime = Date.now();
                this.currentVehicle.userData.falling = false;
            }
            
            // REMOVED: Camera state saving - this should be handled by ControlManager
            // Let controllers manage their own camera setup
            
            return true;
        }
        
        console.log("No vehicle found within interaction range");
        return false;
    }

    // Exit the current vehicle
    static exitVehicle() {
        if (!this.currentVehicle || !PlayersManager.self) return false;
        
        try {
            // Position player slightly away from vehicle
            const exitOffset = new Vector3(0, 2, 5); // Up and behind
            const worldOffset = exitOffset.applyQuaternion(this.currentVehicle.quaternion);
            PlayersManager.self.position.copy(this.currentVehicle.position).add(worldOffset);
            
            // Update vehicle state
            this.currentVehicle.userData.isOccupied = false;
            this.currentVehicle.userData.player = null;
            
            // Update player state
            PlayersManager.self.inVehicle = false;
            
            // Clear current vehicle reference
            this.currentVehicle = null;
            
            return true;
        } catch (err) {
            console.error("Error exiting vehicle:", err);
            return false;
        }
    }
}