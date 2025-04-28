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
            if (vehicle.userData && vehicle.userData.falling && !forceFullAlignment) {
                return;
            }
            
            // CRITICAL FIX: For cars, check if this is the currently driven car
            const isActiveCar = vehicle.userData && 
                               vehicle.userData.type === 'car' && 
                               vehicle === VehicleManager.currentVehicle && 
                               vehicle.userData.isActivelyControlled;
                               
            // Create alignment matrix that orients the vehicle to the planet surface
            // where 'up' vector is along the surface normal
            const defaultUp = new Vector3(0, 1, 0);
            const defaultForward = new Vector3(0, 0, -1);
            
            // Calculate quaternion to rotate from default up to surface normal
            const alignmentQuaternion = new Quaternion();
            
            // Find axis perpendicular to both default up and surface normal
            const rotationAxis = new Vector3().crossVectors(defaultUp, surfaceNormal);
            
            // If rotation axis is too small (normal is parallel to up), use a default axis
            if (rotationAxis.lengthSq() < 0.001) {
                rotationAxis.set(1, 0, 0); // Use X axis as default
            } else {
                rotationAxis.normalize();
            }
            
            // Calculate angle between default up and surface normal
            const angle = Math.acos(Math.min(1, Math.max(-1, defaultUp.dot(surfaceNormal))));
            
            // Set quaternion from axis and angle
            alignmentQuaternion.setFromAxisAngle(rotationAxis, angle);
            
            // ADDED: For player-controlled cars, preserve the current forward direction
            // This ensures cars don't rotate unexpectedly when driving over uneven terrain
            if (isActiveCar) {
                // Preserve car's forward direction relative to the surface
                const carForward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
                
                // Project the car's forward direction onto the planet surface tangent plane
                const projectedForward = carForward.clone().projectOnPlane(surfaceNormal).normalize();
                
                // Create a reference vector on the surface (any perpendicular to normal)
                const refVector = new Vector3(1, 0, 0)
                    .projectOnPlane(surfaceNormal)
                    .normalize();
                    
                // Calculate rotation between reference and projected forward
                const forwardQuat = new Quaternion();
                forwardQuat.setFromUnitVectors(refVector, projectedForward);
                
                // Combine surface alignment with forward direction preservation
                alignmentQuaternion.multiply(forwardQuat);
                
                // Use smaller lerp factor for driving to avoid jarring orientation changes
                lerpFactor = Math.min(lerpFactor, 0.1);
            }
            // Normal (non-forced) alignment for other vehicles
            else if (!forceFullAlignment) {
                // Preserve vehicle's own rotation about the up axis
                // Extract current rotation about vehicle's up axis
                const vehicleUp = new Vector3(0, 1, 0).applyQuaternion(vehicle.quaternion);
                const dot = vehicleUp.dot(surfaceNormal);
                
                // Only preserve rotation if vehicle is reasonably aligned with surface
                if (Math.abs(dot) > 0.7) {
                    // Calculate current yaw (rotation around up axis)
                    const vehicleForward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
                    // Project onto plane perpendicular to surface normal
                    const projectedForward = vehicleForward.clone().projectOnPlane(surfaceNormal).normalize();
                    
                    // Create a reference vector on the same plane
                    const refVector = new Vector3(1, 0, 0)
                        .projectOnPlane(surfaceNormal)
                        .normalize();
                    
                    // Calculate angle between reference and forward
                    let yawAngle = Math.acos(Math.max(-1, Math.min(1, refVector.dot(projectedForward))));
                    
                    // Determine sign of angle
                    const cross = new Vector3().crossVectors(refVector, projectedForward);
                    if (cross.dot(surfaceNormal) < 0) {
                        yawAngle = -yawAngle;
                    }
                    
                    // Create quaternion for yaw around surface normal
                    const yawQuaternion = new Quaternion().setFromAxisAngle(surfaceNormal, yawAngle);
                    
                    // Combine alignment with yaw preservation
                    alignmentQuaternion.multiply(yawQuaternion);
                }
            }
            
            // IMPROVED: Track previous quaternion for smooth transitions
            if (!vehicle.userData.lastAlignmentQuaternion) {
                vehicle.userData.lastAlignmentQuaternion = new Quaternion().copy(vehicle.quaternion);
            }
            
            // IMPROVED: Use gentler alignment factors to let physics naturally handle landing
            let finalLerpFactor = lerpFactor;
            
            // MODIFIED: Different alignment strategies for different states
            if (forceFullAlignment) {
                // For forced full alignment, use very aggressive factor
                finalLerpFactor = 0.95;
            }
            else if (vehicle.userData.hardFreeze) {
                // During hard freeze, use extremely strong alignment
                finalLerpFactor = 0.98;
            }
            // FIXED: Special case for actively driven cars
            else if (isActiveCar) {
                // For actively driven cars, use consistent but gentle alignment
                finalLerpFactor = 0.05;
            }
            else if (vehicle.userData.enhancedStabilization) {
                // During enhanced stabilization, use strong but gradually reducing alignment
                const now = Date.now();
                const endTime = vehicle.userData.enhancedStabilizationEndTime || now;
                const timeFactor = (endTime - now) / 2000; // 2 seconds transition
                finalLerpFactor = 0.2 + (timeFactor * 0.6); // Range from 0.8 down to 0.2
            }
            // CRITICAL FIX: Skip all alignment for falling vehicles
            else if (vehicle.userData.falling) {
                // No alignment at all when falling - let physics handle it naturally
                return;
            } 
            else if (vehicle.userData.landingTime) {
                const timeSinceLanding = Date.now() - vehicle.userData.landingTime;
                
                if (timeSinceLanding < 500) {
                    // First half second - moderate correction
                    finalLerpFactor = Math.max(0.2, lerpFactor);
                } else if (timeSinceLanding < 2000) {
                    // Next 1.5 seconds - gentler correction
                    finalLerpFactor = Math.max(0.1, lerpFactor);
                } else {
                    // After 2 seconds
                    if (vehicle.userData.fullyStabilized) {
                        // For fully stabilized vehicles, use extremely gentle correction
                        finalLerpFactor = 0.001;
                    } else {
                        // For others, use mild correction
                        finalLerpFactor = Math.min(lerpFactor, 0.05);
                    }
                }
            }
            
            // Apply the final rotation with calculated lerp factor
            vehicle.quaternion.slerp(alignmentQuaternion, finalLerpFactor);
            
            // ADDED: Store last alignment quaternion for reference
            vehicle.userData.lastAlignmentQuaternion = vehicle.userData.lastAlignmentQuaternion || new Quaternion();
            vehicle.userData.lastAlignmentQuaternion.copy(vehicle.quaternion);
            
            // IMPROVED: Store when this alignment happened for debugging and state tracking
            vehicle.userData._lastAlignmentTime = Date.now();
            
            // ADDED: Track stabilization progress - if alignment is very small, mark as stabilized
            if (!vehicle.userData.falling && !vehicle.userData.fullyStabilized) {
                const upVector = new Vector3(0, 1, 0).applyQuaternion(vehicle.quaternion);
                const alignmentQuality = Math.abs(upVector.dot(surfaceNormal));
                
                // If well-aligned and landed for more than 5 seconds, mark as fully stabilized
                if (alignmentQuality > 0.98 && 
                    vehicle.userData.landingTime && 
                    (Date.now() - vehicle.userData.landingTime > 5000)) {
                    vehicle.userData.fullyStabilized = true;
                    console.log(`Vehicle ${vehicle.userData.name || 'unnamed'} is now fully stabilized`);
                }
            }
            
            // CRITICAL FIX: Dampen any existing angular velocity
            if (vehicle.userData.angularVelocity) {
                // MODIFIED: Much more aggressive damping during stabilization phases
                let dampingFactor = 0.7; // Default
                
                if (vehicle.userData.hardFreeze) {
                    // During hard freeze, completely zero angular velocity
                    dampingFactor = 0;
                    vehicle.userData.angularVelocity.set(0, 0, 0);
                }
                else if (vehicle.userData.enhancedStabilization) {
                    // During enhanced stabilization, use very aggressive damping
                    dampingFactor = 0.5;
                }
                else if (!vehicle.userData.falling && vehicle.userData.landingTime) {
                    const timeSinceLanding = Date.now() - vehicle.userData.landingTime;
                    if (timeSinceLanding < 3000) {
                        // First 3 seconds after landing, use stronger damping
                        dampingFactor = 0.6;
                    }
                }
                
                if (dampingFactor > 0) {
                    vehicle.userData.angularVelocity.multiplyScalar(dampingFactor);
                }
                
                // If angular velocity is very small, just zero it
                if (vehicle.userData.angularVelocity.lengthSq() < 0.0001) {
                    vehicle.userData.angularVelocity.set(0, 0, 0);
                }
            }
            
            // ADDED: Prevent complete flipping by checking if vehicle is upside down
            const currentUp = new Vector3(0, 1, 0).applyQuaternion(vehicle.quaternion);
            const isUpsideDown = currentUp.dot(surfaceNormal) < -0.5;
            
            if (isUpsideDown && !vehicle.userData.falling) {
                console.log("Vehicle detected as upside down - applying correction");
                
                // Create quaternion to flip vehicle right-side up
                const flipAxis = new Vector3(1, 0, 0); // Use X-axis for flip
                const flipQuat = new Quaternion().setFromAxisAngle(flipAxis, Math.PI);
                
                // Apply flip with strong factor
                vehicle.quaternion.premultiply(flipQuat);
                
                // Force update after flip
                if (vehicle.userData) {
                    vehicle.userData._needsUpdate = true;
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
            
            // Set physics properties
            vehicle.userData.mass = 1000; 
            vehicle.userData.velocity = new Vector3(0, 0, 0);
            vehicle.userData.falling = true;
            vehicle.userData.speed = 0;
            vehicle.userData.maxSpeed = 20;
            vehicle.userData.acceleration = 0;
            vehicle.userData.drag = 0.05;
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
            
            // Set physics properties
            vehicle.userData.mass = 1000; 
            vehicle.userData.velocity = new Vector3(0, 0, 0);
            vehicle.userData.falling = true;
            vehicle.userData.speed = 0;
            vehicle.userData.maxSpeed = 20;
            vehicle.userData.acceleration = 0;
            vehicle.userData.drag = 0.05;
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
        // Handle steering, acceleration, etc. - ONLY user input processing
        // All actual physics movement is handled by Physics class
        
        // Get input state from ControlManager
        const input = ControlManager.getVehicleInput();
        if (!input) return;
        
        // Process acceleration/braking
        if (input.accelerate) {
            car.userData.acceleration += 0.05;
        } else if (input.brake) {
            car.userData.acceleration -= 0.1;
        } else {
            car.userData.acceleration *= 0.9; // Gradual decrease
        }
        
        // Clamp acceleration
        car.userData.acceleration = Math.max(-0.5, Math.min(0.5, car.userData.acceleration));
        
        // Update speed based on acceleration
        car.userData.speed += car.userData.acceleration;
        
        // Apply drag
        car.userData.speed *= (1 - car.userData.drag);
        
        // Clamp speed
        car.userData.speed = Math.max(-car.userData.maxSpeed/2, 
                                     Math.min(car.userData.maxSpeed, car.userData.speed));
        
        // Handle steering
        if (input.turnLeft) {
            car.rotation.y += 0.02;
        } else if (input.turnRight) {
            car.rotation.y -= 0.02;
        }
        
        // Calculate velocity vector from speed and orientation
        const direction = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
        car.userData.velocity.copy(direction.multiplyScalar(car.userData.speed));
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
    
    // ENHANCED: Improved wheel reset method with additional stability checks
    static resetWheelsBaseOrientation(vehicle) {
        if (!vehicle || !vehicle.userData || !vehicle.userData.wheels) return;
        
        try {
            const wheels = vehicle.userData.wheels;
            
            // Get planet normal if available for better alignment
            let surfaceNormal = vehicle.userData.surfaceNormal;
            
            // IMPROVED: Try different sources for the surface normal to ensure consistency
            if (!surfaceNormal) {
                // Try initial landing normal first - most stable reference
                if (vehicle.userData.initialLandingNormal) {
                    surfaceNormal = vehicle.userData.initialLandingNormal;
                }
                // Try stabilization normal next
                else if (vehicle.userData.stabilizationNormal) {
                    surfaceNormal = vehicle.userData.stabilizationNormal;
                }
                // Fall back to calculating from planet position
                else if (vehicle.userData.planet && vehicle.userData.planet.object) {
                    const toVehicle = vehicle.position.clone()
                        .sub(vehicle.userData.planet.object.position)
                        .normalize();
                    surfaceNormal = toVehicle;
                }
            }
            
            // ADDED: Skip wheel reorientation during hard freeze with reduced logging
            if (vehicle.userData.hardFreeze) {
                // FIXED: Add cooldown timer for logging to reduce console spam
                const now = Date.now();
                if (!vehicle.userData._lastWheelOrientLog || 
                    now - vehicle.userData._lastWheelOrientLog > 5000) {  // Log only once every 5 seconds
                    console.log("Skipping wheel orientation during hard freeze");
                    vehicle.userData._lastWheelOrientLog = now;
                }
                return;
            }
            
            // Ensure all wheels are at the correct base rotation
            Object.values(wheels).forEach(wheel => {
                if (wheel) {
                    // Preserve x rotation (rolling) but reset y rotation (steering)
                    const currentRoll = wheel.rotation.x;
                    wheel.rotation.set(
                        currentRoll, // Keep current roll rotation
                        0,          // Reset steering angle
                        Math.PI/2   // Correct perpendicular orientation
                    );
                    
                    // ADDED: If planet normal is available, use it to better align wheels
                    if (surfaceNormal) {
                        // Align wheel y-axis with surface normal
                        const wheelUp = new Vector3(0, 1, 0);
                        const wheelForward = new Vector3(0, 0, 1);
                        
                        // Create orientation that aligns with planet surface
                        // (This ensures wheels follow the car body orientation properly)
                        if (wheel.parent) {
                            wheel.parent.getWorldQuaternion(wheel.quaternion);
                            wheel.rotation.z = Math.PI/2; // Maintain wheel orientation
                        }
                    }
                }
            });
            
            // Store that wheels have been properly oriented
            vehicle.userData.wheelsAligned = true;
            vehicle.userData.wheelAlignmentTime = Date.now();
            
            // ADDED: Don't spam logs during stabilization phases
            if (!vehicle.userData.hardFreeze && !vehicle.userData.enhancedStabilization) {
                // FIXED: Add cooldown for this log message too
                const now = Date.now();
                if (!vehicle.userData._lastWheelAlignLog || 
                    now - vehicle.userData._lastWheelAlignLog > 3000) {  // Log only once every 3 seconds
                    console.log("Wheels aligned to planet surface");
                    vehicle.userData._lastWheelAlignLog = now;
                }
            }
        } catch (err) {
            console.error("Error resetting wheel orientation:", err);
        }
    }

    // Helper method to update car physics
    static updateCar(car, deltaTime) {
        if (!car || !car.userData) return;
        
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
                    window.Physics.maintainVehicleSurfaceHeight(car);
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
            }
            
            // IMPROVED: Use gentler surface height maintenance to let physics work naturally
            if (window.Physics && typeof window.Physics.maintainVehicleSurfaceHeight === 'function') {
                window.Physics.maintainVehicleSurfaceHeight(car);
                
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
                        }
                    }, 100);
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
            if (!vehicle) continue;
            vehicleCount++;
            
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
            
            
            this.currentVehicle = closestVehicle;
            this.currentVehicle.userData.isOccupied = true;
            this.currentVehicle.userData.player = PlayersManager.self;
            this.currentVehicle.userData.hasPlayerInside = true; // Make sure this flag is set
            
            // Update player statei do
            PlayersManager.self.inVehicle = true;
            
            // Make sure controller switch will work by setting this flag
            this.currentVehicle.userData._needsCameraSetup = true;
            
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