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

export default class VehicleManager {
    // Array of all vehicles in the scene
    static vehicles = [];
    static currentVehicle = null;
    
    // Add interaction cooldown timer
    static interactionCooldown = 0;

    // Create a car on the specified planet at the given coordinates
    static createCar(planet, latitude, longitude, heightOffset = 3) {
        try {
            console.log(`Creating car on planet ${planet.name} at lat=${latitude}, lon=${longitude}, height=${heightOffset}`);
            
            // FIXED: Use a more moderate height offset for visual positioning
            const adjustedHeightOffset = 3.5;        
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
            
            // ENHANCED: Use a more precise collision shape for better OBB behavior
            // Create physics shape that better matches car dimensions
            const carWidth = 3;
            const carHeight = 1.5;
            const carLength = 5;
            
            // Register with collision system
            car.userData.width = carWidth;
            car.userData.height = carHeight;
            car.userData.depth = carLength;
            
            const dimensions = {
                width: carWidth,
                height: carHeight,
                depth: carLength
            };
            
            car.collidable = ObjectManager.registerGameObject(car, 'vehicle', dimensions, false);
            
            // Set physics properties
            car.userData.mass = 1000; // Car mass in kg
            car.userData.velocity = new Vector3(0, 0, 0);
            car.userData.onSurface = true;  // Start on surface
            car.userData.falling = false;   // Not falling initially
            car.userData.speed = 0;         // Initial speed is zero
            car.userData.maxSpeed = 30;     // Maximum speed
            car.userData.acceleration = 0;  // Current acceleration
            car.userData.drag = 0.05;       // Air/rolling resistance
            car.userData.bounceFactor = 0.3; // How bouncy the car is on impact
            car.userData.landingDamping = 0.7; // How quickly it settles after landing
            car.userData.fixedHeightOffset = 3.0; // Height above planet surface
            
            // Add vehicle to registry
            this.vehicles.push(car);
            console.log(`Created car at lat=${latitude}, lon=${longitude} on planet ${planet.name}`);
            
            return car;
        } catch (err) {
            console.error("Error creating car:", err);
            return null;
        }
    }
    
    // ADD MISSING: Create an airplane on the specified planet
    static createAirplane(planet, latitude, longitude, heightOffset = 10) {
        try {
            console.log(`Creating airplane on planet ${planet.name} at lat=${latitude}, lon=${longitude}, height=${heightOffset}`);
            
            // Use a higher height offset for airplanes
            const adjustedHeightOffset = Math.max(heightOffset, 15); 
            const airplane = this.createVehicleBase('airplane', planet, latitude, longitude, adjustedHeightOffset);
            
            if (!airplane) {
                console.error("Failed to create airplane base object");
                return null;
            }
            
            // Add a vehicle name
            airplane.userData.name = `Airplane-${Math.floor(Math.random() * 1000)}`;
            
            // Create airplane body
            const bodyGeometry = new BoxGeometry(4, 1.2, 6);
            const bodyMaterial = new MeshBasicMaterial({ color: 0x3366FF });
            const body = new Mesh(bodyGeometry, bodyMaterial);
            body.position.y = -0.2;
            airplane.add(body);
            
            // Create wings
            const wingGeometry = new BoxGeometry(12, 0.5, 2);
            const wingMaterial = new MeshBasicMaterial({ color: 0x4477FF });
            const wings = new Mesh(wingGeometry, wingMaterial);
            wings.position.y = 0.3;
            wings.position.z = 0;
            airplane.add(wings);
            
            // Create tail
            const tailGeometry = new BoxGeometry(3, 1.5, 1);
            const tailMaterial = new MeshBasicMaterial({ color: 0x4477FF });
            const tail = new Mesh(tailGeometry, tailMaterial);
            tail.position.y = 0.5;
            tail.position.z = -3;
            airplane.add(tail);
            
            // Create propeller
            const propellerGeometry = new BoxGeometry(3, 0.2, 0.2);
            const propellerMaterial = new MeshBasicMaterial({ color: 0x333333 });
            const propeller = new Mesh(propellerGeometry, propellerMaterial);
            propeller.position.z = 3.1;
            airplane.add(propeller);
            
            // Store reference to propeller for animation
            airplane.userData.propeller = propeller;
            
            // Register proper collision dimensions
            const airplaneWidth = 12; // Wing span is the widest part
            const airplaneHeight = 2;
            const airplaneLength = 6;
            
            airplane.userData.width = airplaneWidth;
            airplane.userData.height = airplaneHeight;
            airplane.userData.depth = airplaneLength;
            
            const dimensions = {
                width: airplaneWidth,
                height: airplaneHeight,
                depth: airplaneLength
            };
            
            // Register with collision system
            airplane.collidable = ObjectManager.registerGameObject(airplane, 'vehicle', dimensions, false);
            
            // Set physics properties
            airplane.userData.mass = 500; // Airplane mass in kg
            airplane.userData.velocity = new Vector3(0, 0, 0);
            airplane.userData.onSurface = false; // Airplanes start in the air
            airplane.userData.falling = true;
            airplane.userData.speed = 0;
            airplane.userData.maxSpeed = 50; // Higher max speed than cars
            airplane.userData.acceleration = 0;
            airplane.userData.drag = 0.02; // Lower drag than cars
            airplane.userData.bounceFactor = 0.4;
            airplane.userData.landingDamping = 0.6;
            airplane.userData.fixedHeightOffset = 5.0; // Higher off ground when landed
            airplane.userData.lift = 0.05; // Aircraft generate lift based on speed
            
            // Add to registry
            this.vehicles.push(airplane);
            console.log(`Created airplane at lat=${latitude}, lon=${longitude} on planet ${planet.name}`);
            
            return airplane;
        } catch (err) {
            console.error("Error creating airplane:", err);
            return null;
        }
    }
    
    // FIX: Improve vehicle positioning and prevent bouncing
    static alignVehicleToPlanetSurface(vehicle, surfaceNormal, lerpFactor = 0.1) {
        if (!vehicle || !surfaceNormal) return;
        
        try {
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
            const angle = Math.acos(defaultUp.dot(surfaceNormal));
            
            // Set quaternion from axis and angle
            alignmentQuaternion.setFromAxisAngle(rotationAxis, angle);
            
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
            
            // Apply with smooth interpolation to prevent jerky movement
            vehicle.quaternion.slerp(alignmentQuaternion, lerpFactor);
        } catch (err) {
            console.error("Error aligning vehicle to surface:", err);
        }
    }

    // Add the missing createVehicleBase method
    static createVehicleBase(type, planet, latitude, longitude, heightOffset = 2) {
        try {
            if (!planet || !planet.object) {
                console.error(`Invalid planet provided: ${planet ? 'missing object property' : 'null'}`);
                return null;
            }
            
            // Create a new Object3D as the vehicle's container
            const vehicle = new Object3D();
            vehicle.name = `Vehicle-${type}-${Math.floor(Math.random() * 10000)}`;
            
            // Add initial userData
            vehicle.userData = {
                type: type,
                isVehicle: true,
                isOccupied: false,
                planet: planet,
                heightOffset: heightOffset,
                creationTime: Date.now()
            };
            
            // Position the vehicle on the planet surface
            SceneManager.positionObjectOnPlanet(vehicle, planet, latitude, longitude, heightOffset);
            
            // Add to scene
            Engine.scene.add(vehicle);
            
            console.log(`Created vehicle base for ${type} at lat=${latitude}, lon=${longitude}, height=${heightOffset}`);
            return vehicle;
        } catch (err) {
            console.error("Error creating vehicle object:", err);
            return null;
        }
    }

    // Add validation method to check for and fix "ghost" vehicles
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
    
    // Add missing updateCurrentVehicle method called by the game loop
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
            
            // Handle vehicle-specific updates
            const vehicleType = this.currentVehicle.userData.type;
            
            if (vehicleType === 'car') {
                this.updateCar(this.currentVehicle, deltaTime);
            } else if (vehicleType === 'airplane') {
                this.updateAirplane(this.currentVehicle, deltaTime);
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
    
    // Helper method to update car physics
    static updateCar(car, deltaTime) {
        if (!car || !car.userData) return;
        
        try {
            // Get car parameters
            const speed = car.userData.speed || 0;
            const maxSpeed = car.userData.maxSpeed || 30;
            const acceleration = car.userData.acceleration || 0;
            
            // Apply drag to gradually slow down the car
            if (Math.abs(speed) > 0.01) {
                const drag = car.userData.drag || 0.05;
                car.userData.speed *= (1 - drag);
                
                // Zero out very small speeds to prevent floating point errors
                if (Math.abs(car.userData.speed) < 0.01) {
                    car.userData.speed = 0;
                }
            }
            
            // Update car position based on speed and orientation
            if (Math.abs(speed) > 0.01) {
                // Get forward direction from car's orientation
                const forward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
                
                // Move car in the forward direction
                car.position.addScaledVector(forward, speed * deltaTime);
                
                // Update planet reference for gravity
                if (!car.userData.planet) {
                    car.userData.planet = window.Physics.calculateSOI(car.position);
                }
                
                // Update velocity for collision detection
                car.userData.velocity = forward.clone().multiplyScalar(speed);
            }
            
            // Maintain proper height above planet surface
            if (window.Physics && typeof window.Physics.maintainVehicleSurfaceHeight === 'function') {
                window.Physics.maintainVehicleSurfaceHeight(car);
            }
        } catch (err) {
            console.error("Error updating car:", err);
        }
    }
    
    // Helper method to update airplane physics
    static updateAirplane(airplane, deltaTime) {
        if (!airplane || !airplane.userData) return;
        
        try {
            // Get airplane parameters
            const speed = airplane.userData.speed || 0;
            const maxSpeed = airplane.userData.maxSpeed || 50;
            
            // Apply drag effect
            if (Math.abs(speed) > 0.01) {
                const drag = airplane.userData.drag || 0.02;
                airplane.userData.speed *= (1 - drag);
            }
            
            // Update position based on speed and orientation
            if (Math.abs(speed) > 0.01) {
                // Get forward direction from airplane's orientation
                const forward = new Vector3(0, 0, -1).applyQuaternion(airplane.quaternion);
                
                // Move airplane in the forward direction
                airplane.position.addScaledVector(forward, speed * deltaTime);
                
                // Add some lift based on speed
                const lift = (airplane.userData.lift || 0.05) * speed;
                const up = new Vector3(0, 1, 0).applyQuaternion(airplane.quaternion);
                airplane.position.addScaledVector(up, lift * deltaTime);
                
                // Update velocity for collision detection
                airplane.userData.velocity = forward.clone().multiplyScalar(speed);
            }
            
            // Skip planet gravity for airplanes when they have sufficient speed
            if (speed > 10) {
                airplane.userData.ignorePlanetGravity = true;
            } else {
                airplane.userData.ignorePlanetGravity = false;
            }
        } catch (err) {
            console.error("Error updating airplane:", err);
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
                    
                    // Rotate each wheel
                    Object.values(wheels).forEach(wheel => {
                        if (wheel) {
                            wheel.rotation.x += rotationSpeed * deltaTime;
                        }
                    });
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

    static spawnVehicle(params) {
        // ...existing code...
        const safePosition = this.findSafeSpawnPosition(params.position);
        // Use safePosition to place vehicle
        newVehicle.position.copy(safePosition);
        // ...existing code...
    }
}