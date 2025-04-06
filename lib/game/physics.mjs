import SceneManager from './scene.mjs';
import PlayersManager from './players.mjs';
import ControlManager from './control.mjs';
import ObjectManager from './object.mjs';
import VehicleManager from './vehicles.mjs';
import { Vector3, Box3, Object3D } from 'three'; // Ensure Box3 and Object3D are imported

// Lower values create "moon-like" gravity, higher values "earth-like"
const GRAVITY_CONSTANT = 0.5;

// Handles gravity and ground detection for spherical planets
// SOI (Sphere of Influence) determines which planet affects the player
export default class Physics {

    // Make GRAVITY_CONSTANT export available
    static GRAVITY_CONSTANT = GRAVITY_CONSTANT;

    // Finds the planet with strongest gravitational influence
    // Distance is scaled by planet radius to handle different sized planets
    static calculateSOI(position) {
        let closestPlanet = SceneManager.planets[0];
        let closestDistance = Infinity;

        SceneManager.planets.map(planet => {
            const radius = planet.radius;
            const distance = position.distanceTo(planet.object.position);
            const scaledDistance = distance / radius;

            if (scaledDistance < closestDistance) {
                closestDistance = scaledDistance;
                closestPlanet = planet;
            }
        });

        return closestPlanet;
    };

    // Updates player physics, processes all collidable objects:
    static update() {
        PlayersManager.players.map(player => {
            if (player.inVehicle) {
                if (VehicleManager.currentVehicle) {
                    player.position.copy(VehicleManager.currentVehicle.position);
                    if (player.handle !== VehicleManager.currentVehicle) {
                        player.handle.position.copy(VehicleManager.currentVehicle.position);
                    }
                    if (player.handle && player.handle !== VehicleManager.currentVehicle) {
                        player.handle.visible = false;
                        player.handle.traverse(child => {
                            if (child !== player.handle) {
                                child.visible = false;
                            }
                        });
                    }
                    if (player.handle && player.handle.userData) {
                        player.handle.userData.inVehicle = true;
                        player.handle.userData.currentVehicle = VehicleManager.currentVehicle;
                    }
                }
                return;
            } else if (player.handle && player.handle.userData) {
                player.handle.userData.inVehicle = false;
                player.handle.userData.currentVehicle = null;
            }

            const maxVelocity = 15;
            if (player.velocity.lengthSq() > maxVelocity * maxVelocity) {
                player.velocity.normalize().multiplyScalar(maxVelocity);
                console.log("Player velocity capped to prevent tunneling");
            }

            const velocity = player.velocity.clone();
            const speed = velocity.length();
            const numSteps = speed > 5 ? Math.ceil(speed / 5) : 1;
            const subStep = 1.0 / numSteps;

            for (let step = 0; step < numSteps; step++) {
                const stepVelocity = velocity.clone().multiplyScalar(subStep);
                player.position.add(stepVelocity);
                player.handle.position.copy(player.position);
                player.soi = this.calculateSOI(player.position);

                if (player.handle.userData) {
                    player.handle.userData.planet = player.soi;
                }

                if (player.soi.objects && player.soi.objects.length > 0) {
                    const collide = ObjectManager.checkCollisions(player, player.soi.objects, subStep);
                    if (collide) {
                        const { collisionNormal, collisionPosition, closestObject, closestTime } = collide;
                        
                        // MODIFIED: Special handling for vehicle collisions to prevent excessive bounce
                        const restitution = collide.isVehicleCollision ? 0 : 0;
                        const friction = collide.isVehicleCollision ? 0.95 : 0.8;
                        const remainingTime = subStep - closestTime;

                        const velDirection = stepVelocity.clone().normalize();
                        const inDirection = velDirection.dot(collisionNormal) * (1 + restitution);

                        // MODIFIED: For vehicle collisions, use a gentler velocity adjustment
                        const velocityAdjustment = collisionNormal.clone().multiplyScalar(inDirection);
                        
                        if (collide.isVehicleCollision) {
                            // Create a slide effect rather than a bounce
                            // This prevents the player from being flung far away
                            const slideVelocity = stepVelocity.clone().projectOnPlane(collisionNormal);
                            
                            // Apply strong friction to sliding against vehicles
                            slideVelocity.multiplyScalar(0.2);
                            
                            // Replace the velocity with the slide velocity
                            stepVelocity.copy(slideVelocity);
                            
                            // For the main velocity, preserve horizontal movement but dampen vertical
                            const verticalComponent = player.velocity.clone().projectOnVector(collisionNormal);
                            const horizontalComponent = player.velocity.clone().sub(verticalComponent);
                            
                            // Strong damping on vertical component, gentle on horizontal
                            verticalComponent.multiplyScalar(0.1);
                            horizontalComponent.multiplyScalar(0.7);
                            
                            // Update main velocity
                            player.velocity.copy(horizontalComponent).add(verticalComponent);
                        } else {
                            // Regular collision response
                            stepVelocity.sub(velocityAdjustment);
                            player.velocity.sub(velocityAdjustment);
                        }

                        // MODIFIED: Adjust position resolution for vehicle collisions
                        if (collide.isVehicleCollision) {
                            // For vehicle collisions, push the player further away to prevent clipping
                            // Add a small safety buffer to the collision normal
                            const safetyOffset = collisionNormal.clone().multiplyScalar(0.2);
                            collisionPosition.add(safetyOffset);
                            
                            // Log a message when vehicle collision happens
                            if (typeof window !== 'undefined' && window.gameNotify) {
                                // Only notify occasionally to prevent spam
                                const now = Date.now();
                                if (!player._lastVehicleCollision || now - player._lastVehicleCollision > 2000) {
                                    player._lastVehicleCollision = now;
                                    window.gameNotify("Vehicle collision detected - you can't walk through vehicles");
                                }
                            }
                        }

                        const remainingMovement = stepVelocity.clone().multiplyScalar(remainingTime / closestTime);
                        player.position.copy(collisionPosition).add(remainingMovement);
                        player.handle.position.copy(player.position);

                        // Apply friction appropriate for the collision type
                        player.velocity.multiplyScalar(friction);

                        break;
                    }
                }
            }

            const planetRadius = player.soi.radius;
            const collisionDistance = planetRadius + 0.5;
            const soi = player.soi.object;
            const toPlayer = player.position.clone().sub(soi.position);
            const distance = toPlayer.length();
            toPlayer.normalize();

            const surfacePosition = soi.position.clone()
                .add(toPlayer.clone().multiplyScalar(collisionDistance));

            const gravity = GRAVITY_CONSTANT / Math.pow(distance / planetRadius, 2);
            player.velocity.add(toPlayer.clone().multiplyScalar(-gravity));

            const downwardSpeed = player.velocity.dot(toPlayer);
            player.surfaceNormal = toPlayer.clone();

            const canLiftoff = (!player.falling && downwardSpeed < 0);
            const onPlanet = distance <= collisionDistance;

            if (onPlanet || canLiftoff) {
                player.position.copy(surfacePosition);
                player.handle.position.copy(surfacePosition);

                const inVehicle = VehicleManager.currentVehicle &&
                    VehicleManager.currentVehicle.player === player;

                if (player.falling && !inVehicle) {
                    ControlManager.controller?.landing?.(toPlayer);
                }

                player.falling = false;

                if (!inVehicle) {
                    player.velocity.multiplyScalar(1 - player.soi.CoF);
                }
            } else {
                if (!player.falling) {
                    const inVehicle = VehicleManager.currentVehicle &&
                        VehicleManager.currentVehicle.player === player;

                    if (!inVehicle) {
                        ControlManager.controller?.liftoff?.(toPlayer);
                    }
                }

                player.falling = true;
            }

            if (player.collidable) {
                ObjectManager.updateCollidableBounds(player.handle);
            }
        });

        for (const collidable of ObjectManager.collidableObjects) {
            if (!collidable.active) continue;
            if (collidable.isStatic) continue;
            if (collidable.type === 'player') continue;

            if (collidable.type === 'vehicle') {
                const vehicle = collidable.object;

                if (vehicle === VehicleManager.currentVehicle) {
                    this.applyVehiclePhysics(vehicle);

                    if (vehicle.userData) {
                        vehicle.userData.hasPlayerInside = true;
                        vehicle.userData.player = PlayersManager.self;
                    }
                } else {
                    this.applyVehiclePhysics(vehicle);

                    if (vehicle.userData) {
                        vehicle.userData.hasPlayerInside = false;
                        vehicle.userData.player = null;
                    }
                }
            } else {
                this.applyGravityToObject(collidable.object);
            }

            if (!collidable.isStatic && collidable.object.userData && collidable.object.userData.velocity) {
                const maxObjVelocity = 20;
                const velocity = collidable.object.userData.velocity;
                if (velocity.lengthSq() > maxObjVelocity * maxObjVelocity) {
                    velocity.normalize().multiplyScalar(maxObjVelocity);
                }
            }
        }

        PlayersManager.updatePlayerColliders();
    };

    // Updates players and non-vehicle physics only
    static updateNonVehicles() {
        PlayersManager.players.map(player => {
            if (player.inVehicle) return;

            const maxVelocity = 15;
            if (player.velocity.lengthSq() > maxVelocity * maxVelocity) {
                player.velocity.normalize().multiplyScalar(maxVelocity);
            }

            const velocity = player.velocity.clone();
            const speed = velocity.length();
            const numSteps = speed > 5 ? Math.ceil(speed / 5) : 1;
            const subStep = 1.0 / numSteps;

            for (let step = 0; step < numSteps; step++) {
                const stepVelocity = velocity.clone().multiplyScalar(subStep);
                player.position.add(stepVelocity);
                player.handle.position.copy(player.position);
                player.soi = this.calculateSOI(player.position);

                if (player.handle.userData) {
                    player.handle.userData.planet = player.soi;
                }

                if (player.soi.objects && player.soi.objects.length > 0) {
                    const collide = ObjectManager.checkCollisions(player, player.soi.objects, subStep);
                    if (collide) {
                        const { collisionNormal, collisionPosition, closestTime } = collide;
                        const restitution = 0;
                        const remainingTime = subStep - closestTime;

                        const velDirection = stepVelocity.clone().normalize();
                        const inDirection = velDirection.dot(collisionNormal) * (1 + restitution);

                        const velocityAdjustment = collisionNormal.clone().multiplyScalar(inDirection);
                        stepVelocity.sub(velocityAdjustment);
                        player.velocity.sub(velocityAdjustment);

                        const remainingMovement = stepVelocity.clone().multiplyScalar(remainingTime / closestTime);
                        player.position.copy(collisionPosition).add(remainingMovement);
                        player.handle.position.copy(player.position);

                        const friction = 0.8;
                        player.velocity.multiplyScalar(friction);

                        break;
                    }
                }
            }

            const planetRadius = player.soi.radius;
            const collisionDistance = planetRadius + 0.5;
            const soi = player.soi.object;
            const toPlayer = player.position.clone().sub(soi.position);
            const distance = toPlayer.length();
            toPlayer.normalize();

            const surfacePosition = soi.position.clone()
                .add(toPlayer.clone().multiplyScalar(collisionDistance));

            const gravity = GRAVITY_CONSTANT / Math.pow(distance / planetRadius, 2);
            player.velocity.add(toPlayer.clone().multiplyScalar(-gravity));

            const downwardSpeed = player.velocity.dot(toPlayer);
            player.surfaceNormal = toPlayer.clone();

            const canLiftoff = (!player.falling && downwardSpeed < 0);
            const onPlanet = distance <= collisionDistance;

            if (onPlanet || canLiftoff) {
                player.position.copy(surfacePosition);
                player.handle.position.copy(surfacePosition);

                if (player.falling) {
                    ControlManager.controller?.landing?.(toPlayer);
                }

                player.falling = false;
                player.velocity.multiplyScalar(1 - player.soi.CoF);
            } else {
                if (!player.falling) {
                    ControlManager.controller?.liftoff?.(toPlayer);
                }

                player.falling = true;
            }

            if (player.collidable) {
                ObjectManager.updateCollidableBounds(player.handle);
            }
        });

        for (const collidable of ObjectManager.collidableObjects) {
            if (!collidable.active || collidable.isStatic || 
                collidable.type === 'vehicle' || collidable.type === 'player') continue;

            this.applyGravityToObject(collidable.object);
        }

        // CRITICAL FIX: Add check to ensure VehicleManager is properly initialized
        if (VehicleManager && typeof VehicleManager.updateCurrentVehicle === 'function') {
            // Update position of current vehicle if one exists (minimal update)
            if (VehicleManager.currentVehicle) {
                // Only update the player-carrying vehicle
                const vehicle = VehicleManager.currentVehicle;
                if (vehicle.userData && vehicle.userData.isOccupied) {
                    // Simply update the collider bounds without applying full physics
                    if (vehicle.collidable) {
                        ObjectManager.updateCollidableBounds(vehicle);
                    }
                }
            }
        } else {
            console.warn("VehicleManager not properly initialized in Physics.updateNonVehicles");
        }

        PlayersManager.updatePlayerColliders();
    }

    // Apply gravity to a dynamic object
    static applyGravityToObject(object) {
        if (!object.userData) {
            object.userData = {};
        }

        if (!object.userData.velocity) {
            object.userData.velocity = new Vector3();
        }

        if (!object.userData.planet) {
            object.userData.planet = this.calculateSOI(object.position);
        }

        const planet = object.userData.planet;
        if (!planet) return;

        const planetCenter = planet.object.position;
        const toObject = object.position.clone().sub(planetCenter);
        const distance = toObject.length();
        const surfaceDistance = distance - planet.radius;
        toObject.normalize();

        const gravity = GRAVITY_CONSTANT / Math.pow(distance / planet.radius, 2);
        object.userData.velocity.addScaledVector(toObject, -gravity);

        object.position.add(object.userData.velocity);

        const collisionDistance = planet.radius + 1.0;
        if (distance <= collisionDistance) {
            object.position.copy(planetCenter).addScaledVector(toObject, collisionDistance);
            object.userData.velocity.multiplyScalar(1 - (planet.CoF || 0.2));

            const downSpeed = object.userData.velocity.dot(toObject);
            if (downSpeed < 0) {
                const restitution = 0.3;
                object.userData.velocity.addScaledVector(toObject, -downSpeed * (1 + restitution));
            }
        }
    };

    // Apply complete physics simulation to a vehicle (gravity, landing, etc)
    static applyVehiclePhysics(vehicle) {
        if (!vehicle || !vehicle.userData) return;

        try {
            // Skip physics for player's current vehicle
            if (vehicle === VehicleManager.currentVehicle && vehicle.userData.isOccupied) {
                // IMPORTANT FIX: Even for player-controlled vehicles, we should still
                // maintain the correct height above the planet surface
                this.maintainVehicleSurfaceHeight(vehicle);
                return;
            }

            // Calculate planet and get surface normal
            if (!vehicle.userData.planet) {
                vehicle.userData.planet = this.calculateSOI(vehicle.position);
            }
            const planet = vehicle.userData.planet;
            if (!planet) return;

            const planetCenter = planet.object.position;
            const toVehicle = vehicle.position.clone().sub(planetCenter);
            const distance = toVehicle.length();
            const surfaceNormal = toVehicle.normalize();
            
            // Apply gravity to unoccupied vehicles
            if (!vehicle.userData.velocity) {
                vehicle.userData.velocity = new Vector3();
            }
            
            // Calculate gravity and apply to velocity
            const gravity = GRAVITY_CONSTANT / Math.pow(distance / planet.radius, 2);
            vehicle.userData.velocity.addScaledVector(surfaceNormal, -gravity);
            
            // IMPROVED: Check for collisions with walls or other vehicles
            const collisions = ObjectManager.checkCollisionsWithType(vehicle, ['wall', 'vehicle']);
            if (collisions.length > 0) {
                // We hit something - handle collision response
                for (const collision of collisions) {
                    const other = collision.other;
                    
                    // Get collision normal between vehicle and other object
                    const toOther = other.position.clone().sub(vehicle.position).normalize();
                    
                    // Simple collision response - reverse velocity along collision normal
                    const velAlongNormal = vehicle.userData.velocity.dot(toOther);
                    if (velAlongNormal < 0) {
                        // We're moving toward the other object
                        vehicle.userData.velocity.addScaledVector(toOther, -velAlongNormal * 1.2); // Bounce
                        
                        // Add some damping to prevent excessive bouncing
                        vehicle.userData.velocity.multiplyScalar(0.8);
                    }
                }
            }
            
            // FIXED: Apply velocity to position using very small increments to prevent overshooting
            // This is critical to avoid the car "falling through" the planet surface
            const speed = vehicle.userData.velocity.length();
            const steps = Math.max(1, Math.ceil(speed / 0.5)); // More steps for higher speeds
            const subStep = 1.0 / steps;
            
            for (let i = 0; i < steps; i++) {
                // Apply small fraction of velocity
                const stepVelocity = vehicle.userData.velocity.clone().multiplyScalar(subStep);
                vehicle.position.add(stepVelocity);
                
                // Check if we're now at/below the target height
                const newDistance = vehicle.position.clone().sub(planetCenter).length();
                const targetHeight = planet.radius + (vehicle.userData.fixedHeightOffset || 3.0);
                
                if (newDistance <= targetHeight) {
                    // We've hit the ground, break out of movement loop
                    break;
                }
            }
            
            // Detect landing on the planet surface
            // FIXED: Use consistent fixed height for car
            const heightOffset = vehicle.userData.type === 'car' ? 3.0 : 3.0;
            const groundLevel = planet.radius + heightOffset;
            
            if (distance <= groundLevel) {
                // IMPROVED: More aggressive height correction when hitting ground
                vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, groundLevel);
                
                // FIXED: Dramatically reduce bounce effect and velocity when landing
                if (vehicle.userData.falling) {
                    // Apply strong damping based on landing speed
                    const impactSpeed = -vehicle.userData.velocity.dot(surfaceNormal);
                    const landingDamping = vehicle.userData.landingDamping || 0.95;
                    const bounceFactor = vehicle.userData.bounceFactor || 0.1;
                    
                    // Only allow tiny bounce for smooth landing
                    if (impactSpeed > 0.1) {
                        // Convert downward velocity to tiny upward bounce
                        vehicle.userData.velocity.addScaledVector(surfaceNormal, impactSpeed * bounceFactor);
                        
                        // Add aggressive damping to stop bouncing quickly
                        vehicle.userData.velocity.multiplyScalar(landingDamping);
                    } else {
                        // For very soft landings, just zero the vertical velocity completely
                        const verticalComponent = surfaceNormal.clone().multiplyScalar(
                            vehicle.userData.velocity.dot(surfaceNormal)
                        );
                        vehicle.userData.velocity.sub(verticalComponent);
                        vehicle.userData.velocity.multiplyScalar(0.9); // Slight overall damping
                    }
                } else {
                    // Already on ground - use friction to slow down
                    const frictionFactor = 1.0 - (planet.CoF || 0.2);
                    
                    // FIXED: Split velocity into normal (vertical) and tangent (horizontal) components
                    const normalVel = vehicle.userData.velocity.dot(surfaceNormal);
                    const normalComponent = surfaceNormal.clone().multiplyScalar(normalVel);
                    const tangentComponent = vehicle.userData.velocity.clone().sub(normalComponent);
                    
                    // ZERO the normal component (prevent any bouncing)
                    vehicle.userData.velocity.copy(tangentComponent);
                    
                    // Apply friction to tangent component
                    vehicle.userData.velocity.multiplyScalar(frictionFactor);
                    
                    // If very slow, just stop completely
                    if (vehicle.userData.velocity.lengthSq() < 0.005) {
                        vehicle.userData.velocity.set(0, 0, 0);
                    }
                }
                
                // Properly align with surface
                VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal);
                vehicle.userData.onSurface = true;
                
                // Mark as not falling as soon as velocity is small
                if (vehicle.userData.velocity.lengthSq() < 0.01) {
                    vehicle.userData.falling = false;
                }
            } else {
                // We're in the air
                vehicle.userData.falling = true;
                vehicle.userData.onSurface = false;
            }
        } catch (e) {
            console.error("Error in vehicle physics:", e);
        }
    }
    
    // EXTREMELY SIMPLIFIED: Only handle orientation, not height
    static maintainVehicleSurfaceHeight(vehicle) {
        if (!vehicle || !vehicle.userData || !vehicle.userData.planet) return;

        try {
            const planet = vehicle.userData.planet;
            const planetCenter = planet.object.position;
            const toVehicle = vehicle.position.clone().sub(planetCenter);
            const distance = toVehicle.length();
            const surfaceNormal = toVehicle.normalize();
            
            // CRITICAL FIX: Force exact height for cars at all times
            if (vehicle.userData.type === 'car') {
                // Force consistent height of exactly 3 units
                const targetHeight = planet.radius + 3.0;
                
                // If height is off by any amount, immediately fix it
                // IMPROVED: More strict tolerance and aggressive correction
                if (Math.abs(distance - targetHeight) > 0.001) {
                    vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, targetHeight);
                
                    // Also zero any vertical velocity component to prevent bouncing
                    if (vehicle.userData.velocity) {
                        const verticalComponent = surfaceNormal.clone().multiplyScalar(
                            vehicle.userData.velocity.dot(surfaceNormal)
                        );
                        vehicle.userData.velocity.sub(verticalComponent);
                    }
                }
                
                // Only care about orientation, not height
                if (typeof VehicleManager === 'object' && 
                    typeof VehicleManager.alignVehicleToPlanetSurface === 'function') {
                    VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.1);
                } else {
                    // Fallback if VehicleManager isn't available (avoids errors)
                    vehicle.up.copy(surfaceNormal);
                }
            }
        } catch (e) {
            console.error("Error maintaining vehicle orientation:", e);
        }
    }
    
    // ADDED: Simple vehicle stabilization helper to handle edge cases
    static ensureVehicleStability(vehicle) {
        if (!vehicle || !vehicle.userData || !vehicle.userData.planet) {
            return false;
        }
        
        try {
            const planet = vehicle.userData.planet;
            const planetCenter = planet.object.position;
            const toVehicle = vehicle.position.clone().sub(planetCenter);
            const surfaceNormal = toVehicle.normalize();
            
            // Just ensure vehicle up vector is aligned with surface normal
            vehicle.up.copy(surfaceNormal);
            
            return true;
        } catch (e) {
            console.error("Error in ensureVehicleStability:", e);
            return false;
        }
    }
    
    // Handle vehicle landing on a planet surface
    static vehicleLanding(vehicle, surfaceNormal) {
        if (!vehicle || !vehicle.userData) return;

        try {
            console.log(`Processing landing for ${vehicle.userData.name}, was falling=${vehicle.userData.falling}, is on surface=${vehicle.userData.onSurface}`);

            let originalForward = null;
            if (vehicle.userData.type === 'car') {
                originalForward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
            }

            const fallingSpeed = vehicle.userData.velocity.dot(surfaceNormal.clone().negate());
            console.log(`Vehicle ${vehicle.userData.name} landed on surface with impact speed: ${fallingSpeed.toFixed(2)}`);

            if (fallingSpeed > 2 && typeof window !== 'undefined' && window.gameNotify) {
                window.gameNotify(`${vehicle.userData.name} crashed with impact speed: ${fallingSpeed.toFixed(1)}!`);
            }

            if (vehicle.userData.type === 'car') {
                const planetCenter = vehicle.userData.planet.object.position;
                const toVehicle = vehicle.position.clone().sub(planetCenter).normalize();

                // FIXED: Force exact height of 3 units above planet
                vehicle.position.copy(planetCenter).addScaledVector(toVehicle, 
                    vehicle.userData.planet.radius + 3.0);

                const up = toVehicle.clone();
                const projectedForward = originalForward.clone().projectOnPlane(up).normalize();
                const right = new Vector3().crossVectors(up, projectedForward).normalize();
                const correctedForward = new Vector3().crossVectors(right, up).normalize();

                vehicle.up.copy(up);
                const lookTarget = new Vector3().copy(vehicle.position).add(correctedForward);
                vehicle.lookAt(lookTarget);

                // FIXED: Completely zero vertical velocity to prevent any bouncing
                const verticalComponent = up.clone().multiplyScalar(vehicle.userData.velocity.dot(up));
                vehicle.userData.velocity.sub(verticalComponent);
                
                // FIXED: Apply very strong horizontal damping too
                vehicle.userData.velocity.multiplyScalar(0.3);
                
                // If very small velocity, just zero it completely
                if (vehicle.userData.velocity.lengthSq() < 0.01) {
                    vehicle.userData.velocity.set(0, 0, 0);
                }
                
                vehicle.userData._stabilizeUntil = Date.now() + 800;
                vehicle.userData.speed = 0;  // Reset speed completely upon landing
            }
            else if (vehicle.userData.type === 'airplane') {
                // Airplane landing code would go here
            }

            vehicle.userData.falling = false;
            vehicle.userData.onSurface = true;

        } catch (e) {
            console.error("Error in vehicle landing:", e);
        }
    }
};
