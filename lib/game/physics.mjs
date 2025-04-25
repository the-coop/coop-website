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
        // CRITICAL FIX: Add safety check for empty planets array
        if (!SceneManager.planets || SceneManager.planets.length === 0) {
            console.error("No planets available in SceneManager.planets");
            return null;
        }

        let closestPlanet = SceneManager.planets[0];
        let closestDistance = Infinity;

        // CRITICAL FIX: Ensure planets are valid before processing
        SceneManager.planets.forEach(planet => {
            if (!planet || !planet.radius || !planet.object) {
                console.warn("Invalid planet in SceneManager.planets");
                return; // Skip this planet
            }

            const radius = planet.radius;
            const distance = position.distanceTo(planet.object.position);
            const scaledDistance = distance / radius;

            if (scaledDistance < closestDistance) {
                closestDistance = scaledDistance;
                closestPlanet = planet;
            }
        });

        // CRITICAL FIX: Ensure planet has objects array
        if (closestPlanet && !closestPlanet.objects) {
            closestPlanet.objects = [];
        }

        return closestPlanet;
    };

    // Updates player physics, processes all collidable objects:
    static update() {
        try {
            // ADDED: Recovery counter for detecting when player is lost in space
            if (!this._recoveryTimer) this._recoveryTimer = 0;
            
            PlayersManager.players.forEach(player => {
                if (!player) return;
                
                // Handle vehicles
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

                // ADDED: Reset extreme velocities to prevent bouncing into space
                if (player.velocity && player.velocity.lengthSq() > 100) { // 10 units/sec
                    console.warn("Extreme velocity detected, might be collision error. Reducing velocity.");
                    player.velocity.normalize().multiplyScalar(8);
                    
                    // Reset last collision data to avoid repeated bad collisions
                    player._lastCollidedWith = null;
                    player._lastCollisionTime = 0;
                    player._falseCollisionCount = (player._falseCollisionCount || 0) + 1;
                    
                    // If we get many false collisions, try to recover the player
                    if (player._falseCollisionCount > 3) {
                        this._recoveryTimer = 30; // Start recovery process
                    }
                }

                // Cap velocity
                const maxVelocity = 15;
                if (player.velocity && player.velocity.lengthSq() > maxVelocity * maxVelocity) {
                    player.velocity.normalize().multiplyScalar(maxVelocity);
                    console.log("Player velocity capped to prevent tunneling");
                }

                // Safety check for velocity
                if (!player.velocity) {
                    console.error("Player missing velocity property");
                    player.velocity = new Vector3();
                    return;
                }

                const velocity = player.velocity.clone();
                const speed = velocity.length();
                const numSteps = speed > 5 ? Math.ceil(speed / 5) : 1;
                const subStep = 1.0 / numSteps;

                for (let step = 0; step < numSteps; step++) {
                    try {
                        const stepVelocity = velocity.clone().multiplyScalar(subStep);
                        player.position.add(stepVelocity);
                        
                        if (player.handle) {
                            player.handle.position.copy(player.position);
                        } else {
                            console.warn("Player missing handle in physics update");
                            continue;
                        }
                        
                        // Get sphere of influence (nearest planet)
                        player.soi = this.calculateSOI(player.position);
                        if (!player.soi) {
                            console.error("Failed to calculate SOI for player");
                            continue; // Skip collision check if no valid SOI
                        }

                        if (player.handle.userData) {
                            player.handle.userData.planet = player.soi;
                        }

                        // ENHANCED: Use more robust collision detection with full try/catch
                        let collide = null;
                        try {
                            // IMPROVED: Add distance filtering to prevent false collisions with far objects
                            if (ObjectManager.collidableObjects && ObjectManager.collidableObjects.length > 0) {
                                // Filter objects by distance first
                                const nearbyObjects = ObjectManager.collidableObjects.filter(item => {
                                    if (!item || !item.object || item.type === 'player') return false;
                                    
                                    // ADDED: Skip collision with objects that are too far away (50 units)
                                    const maxCollisionDist = 50;
                                    const distSq = player.position.distanceToSquared(item.object.position);
                                    return distSq < maxCollisionDist * maxCollisionDist;
                                });
                                
                                // Only check collisions with nearby objects
                                if (nearbyObjects.length > 0) {
                                    collide = ObjectManager.checkCollisions(player, nearbyObjects, subStep);
                                    
                                    // ADDED: Debug when collisions are detected
                                    if (collide) {
                                        const now = Date.now();
                                        player._lastCollisionTime = now;
                                        
                                        // Log collision details if debug is enabled
                                        const dist = player.position.distanceTo(collide.closestObject.object.position);
                                        console.log(`Collision detected with ${collide.closestObject.type} at distance ${dist.toFixed(2)}`);
                                    }
                                }
                            }
                        } catch (err) {
                            console.error("Error in collision detection:", err);
                        }
                        
                        if (collide) {
                            const { collisionNormal, collisionPosition, closestObject, closestTime } = collide;
                            
                            // IMPROVED: Add safety check for false collisions
                            const collisionDist = player.position.distanceTo(closestObject.object.position);
                            if (collisionDist > 30) {
                                console.warn(`Suspicious collision detected at distance ${collisionDist.toFixed(2)}. Ignoring.`);
                                continue; // Skip this suspicious collision
                            }
                            
                            // IMPROVED: Safe collision response
                            try {
                                // Special handling for vehicle collisions
                                const restitution = collide.isVehicleCollision ? 0 : 0;
                                const friction = collide.isVehicleCollision ? 0.95 : 0.8;
                                const remainingTime = subStep - closestTime;

                                const velDirection = stepVelocity.clone().normalize();
                                const inDirection = velDirection.dot(collisionNormal) * (1 + restitution);

                                // For vehicle collisions, use a gentler velocity adjustment
                                const velocityAdjustment = collisionNormal.clone().multiplyScalar(inDirection);
                                
                                if (collide.isVehicleCollision) {
                                    // Create a slide effect for vehicle collisions
                                    const slideVelocity = stepVelocity.clone().projectOnPlane(collisionNormal);
                                    slideVelocity.multiplyScalar(0.2);
                                    stepVelocity.copy(slideVelocity);
                                    
                                    // Update main velocity components
                                    const verticalComponent = player.velocity.clone().projectOnVector(collisionNormal);
                                    const horizontalComponent = player.velocity.clone().sub(verticalComponent);
                                    
                                    verticalComponent.multiplyScalar(0.1);
                                    horizontalComponent.multiplyScalar(0.7);
                                    
                                    player.velocity.copy(horizontalComponent).add(verticalComponent);
                                } else {
                                    // Regular collision response
                                    stepVelocity.sub(velocityAdjustment);
                                    player.velocity.sub(velocityAdjustment);
                                }

                                // Adjust position for vehicle collisions
                                if (collide.isVehicleCollision) {
                                    const safetyOffset = collisionNormal.clone().multiplyScalar(0.2);
                                    collisionPosition.add(safetyOffset);
                                    
                                    // Notify about vehicle collision
                                    if (typeof window !== 'undefined' && window.gameNotify) {
                                        const now = Date.now();
                                        if (!player._lastVehicleCollision || now - player._lastVehicleCollision > 2000) {
                                            player._lastVehicleCollision = now;
                                            window.gameNotify("Vehicle collision detected - you can't walk through vehicles");
                                        }
                                    }
                                }

                                // Apply position correction
                                const remainingMovement = stepVelocity.clone().multiplyScalar(remainingTime / Math.max(0.001, closestTime));
                                player.position.copy(collisionPosition).add(remainingMovement);
                                if (player.handle) {
                                    player.handle.position.copy(player.position);
                                }

                                // Apply friction
                                player.velocity.multiplyScalar(friction);
                            } catch (err) {
                                console.error("Error in collision response:", err);
                            }
                            
                            break;
                        }
                    } catch (stepErr) {
                        console.error("Error in physics step:", stepErr);
                    }
                }

                // ENHANCED: Planet gravity and surface handling with safety checks
                try {
                    // Skip further physics if we don't have valid planet data
                    if (!player.soi || !player.soi.radius || !player.soi.object) {
                        console.error("Invalid planet data in player SOI");
                        return;
                    }

                    const planetRadius = player.soi.radius;
                    const collisionDistance = planetRadius + 0.5;
                    const soi = player.soi.object;
                    
                    if (!soi || !soi.position) {
                        console.error("Invalid SOI object or position");
                        return;
                    }
                    
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
                        if (player.handle) {
                            player.handle.position.copy(surfacePosition);
                        }

                        const inVehicle = VehicleManager.currentVehicle &&
                            VehicleManager.currentVehicle.player === player;

                        if (player.falling && !inVehicle && ControlManager.controller?.landing) {
                            ControlManager.controller.landing(toPlayer);
                        }

                        player.falling = false;

                        if (!inVehicle && player.soi.CoF) {
                            player.velocity.multiplyScalar(1 - player.soi.CoF);
                        }
                    } else {
                        if (!player.falling) {
                            const inVehicle = VehicleManager.currentVehicle &&
                                VehicleManager.currentVehicle.player === player;

                            if (!inVehicle && ControlManager.controller?.liftoff) {
                                ControlManager.controller.liftoff(toPlayer);
                            }
                        }

                        player.falling = true;
                    }
                } catch (gravityErr) {
                    console.error("Error in planet gravity processing:", gravityErr);
                }

                // Update player's collision bounds
                if (player.handle && player.collidable) {
                    try {
                        ObjectManager.updateCollidableBounds(player.handle);
                    } catch (err) {
                        console.error("Error updating player collision bounds:", err);
                    }
                }
            });

            // ADDED: Player recovery system - if player gets lost in space, bring them back
            if (this._recoveryTimer > 0) {
                this._recoveryTimer--;
                
                // When recovery timer reaches zero, check if player needs recovery
                if (this._recoveryTimer === 0 && PlayersManager.self) {
                    const player = PlayersManager.self;
                    const nearestPlanet = this.calculateSOI(player.position);
                    
                    if (nearestPlanet) {
                        const dist = player.position.distanceTo(nearestPlanet.object.position);
                        
                        // If player is extremely far from planet, move them back
                        if (dist > nearestPlanet.radius * 5) {
                            console.warn("Player detected too far from planet, performing emergency recovery");
                            
                            // Reset position to above planet surface
                            const toPlayer = player.position.clone().sub(nearestPlanet.object.position).normalize();
                            const safePosition = nearestPlanet.object.position.clone()
                                .add(toPlayer.multiplyScalar(nearestPlanet.radius + 10));
                            
                            // Teleport player back
                            player.position.copy(safePosition);
                            if (player.handle) player.handle.position.copy(safePosition);
                            
                            // Reset physics state
                            player.velocity.set(0, 0, 0);
                            player.falling = true;
                            
                            // Notify player
                            if (typeof window !== 'undefined' && window.gameNotify) {
                                window.gameNotify("You were recovered from deep space!");
                            }
                        }
                    }
                    
                    // Clear false collision counter
                    player._falseCollisionCount = 0;
                }
            }

            // Process all collidable objects
            try {
                for (const collidable of ObjectManager.collidableObjects) {
                    if (!collidable || !collidable.active || collidable.isStatic) continue;
                    if (collidable.type === 'player') continue;

                    if (collidable.type === 'vehicle' && collidable.object) {
                        try {
                            this.applyVehiclePhysics(collidable.object);
                            
                            // Update vehicle player relationship
                            if (collidable.object === VehicleManager.currentVehicle && collidable.object.userData) {
                                collidable.object.userData.hasPlayerInside = true;
                                collidable.object.userData.player = PlayersManager.self;
                            } else if (collidable.object.userData) {
                                collidable.object.userData.hasPlayerInside = false;
                                collidable.object.userData.player = null;
                            }
                        } catch (err) {
                            console.error("Error in vehicle physics:", err);
                        }
                    } else {
                        try {
                            this.applyGravityToObject(collidable.object);
                        } catch (err) {
                            console.error("Error in object gravity:", err);
                        }
                    }

                    // Cap object velocity
                    if (!collidable.isStatic && collidable.object && collidable.object.userData && collidable.object.userData.velocity) {
                        try {
                            const maxObjVelocity = 20;
                            const velocity = collidable.object.userData.velocity;
                            if (velocity.lengthSq() > maxObjVelocity * maxObjVelocity) {
                                velocity.normalize().multiplyScalar(maxObjVelocity);
                            }
                        } catch (err) {
                            console.error("Error capping object velocity:", err);
                        }
                    }
                    
                    // Mark the object has moved for collision detection
                    if (collidable.object && collidable.object.userData) {
                        collidable.object.userData.hasMovedSinceLastCheck = true;
                    }
                    
                    // Update collision bounds
                    try {
                        ObjectManager.updateCollidableBounds(collidable.object);
                    } catch (err) {
                        console.error("Error updating collidable bounds:", err);
                    }
                }
            } catch (objErr) {
                console.error("Error processing collidable objects:", objErr);
            }

            // Update player colliders as the last step
            try {
                PlayersManager.updatePlayerColliders();
            } catch (err) {
                console.error("Error updating player colliders:", err);
            }
        } catch (mainErr) {
            console.error("CRITICAL ERROR in physics update:", mainErr);
        }
    };

    // ENHANCED: Improved vehicle-object collision detection
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
            
            // ADDED: Store surface normal in vehicle for alignment and collision
            vehicle.userData.surfaceNormal = surfaceNormal;
            
            // Apply gravity to unoccupied vehicles
            if (!vehicle.userData.velocity) {
                vehicle.userData.velocity = new Vector3();
            }
            
            // Calculate gravity and apply to velocity
            const gravity = GRAVITY_CONSTANT / Math.pow(distance / planet.radius, 2);
            vehicle.userData.velocity.addScaledVector(surfaceNormal, -gravity);
            
            // ENHANCED: Improved collision detection using OBB
            const collisions = ObjectManager.checkAllCollisions(vehicle, ['wall', 'vehicle']);
            if (collisions.length > 0) {
                // We hit something - handle collision response
                for (const collision of collisions) {
                    const other = collision.other;
                    
                    // Get improved collision normal from OBB intersection
                    const normal = collision.normal || new Vector3().subVectors(vehicle.position, other.position).normalize();
                    
                    // Simple collision response - reverse velocity along collision normal
                    const velAlongNormal = vehicle.userData.velocity.dot(normal);
                    if (velAlongNormal < 0) {
                        // We're moving toward the other object
                        vehicle.userData.velocity.addScaledVector(normal, -velAlongNormal * 1.2); // Bounce
                        
                        // Add some damping to prevent excessive bouncing
                        vehicle.userData.velocity.multiplyScalar(0.8);
                    }
                }
            }
            
            // Apply velocity to position
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
                // IMPROVED: MORE aggressive height correction to keep object ON sphere radius
                vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, groundLevel);
                
                // ADDED: Update surface normal again after position correction
                vehicle.userData.surfaceNormal = surfaceNormal;
                
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
                    // IMPROVED: Reduced rolling friction for vehicles compared to players
                    const frictionFactor = 1.0 - ((planet.CoF || 0.2) * 0.5); // Halved friction coefficient
                    
                    // FIXED: Split velocity into normal (vertical) and tangent (horizontal) components
                    const normalVel = vehicle.userData.velocity.dot(surfaceNormal);
                    const normalComponent = surfaceNormal.clone().multiplyScalar(normalVel);
                    const tangentComponent = vehicle.userData.velocity.clone().sub(normalComponent);
                    
                    // ZERO the normal component (prevent any bouncing)
                    vehicle.userData.velocity.copy(tangentComponent);
                    
                    // Apply friction to tangent component - lessened for rolling wheels
                    vehicle.userData.velocity.multiplyScalar(frictionFactor);
                    
                    // If very slow, just stop completely
                    if (vehicle.userData.velocity.lengthSq() < 0.003) { // Reduced from 0.005 for smoother rolling
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

            // ENHANCED: Update OBB collision bounds after moving vehicle
            if (vehicle.collidable) {
                ObjectManager.updateCollidableBounds(vehicle);
            }
            
        } catch (e) {
            console.error("Error in vehicle physics:", e);
        }
    }
    
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
                // Use saved fixed height offset with adjusted value
                const targetHeight = planet.radius + 
                    (vehicle.userData.fixedHeightOffset || 1.94); // Updated from 1.92 to 1.94
                
                // If height is off by any amount, immediately fix it
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

                // FIXED: Use the vehicle's fixedHeightOffset property with adjusted value
                vehicle.position.copy(planetCenter).addScaledVector(toVehicle, 
                    vehicle.userData.planet.radius + (vehicle.userData.fixedHeightOffset || 1.94));

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

    // ADDED: Utility to ensure planet has required properties
    static validatePlanet(planet) {
        if (!planet) return false;
        
        // Check essential properties
        if (!planet.radius || !planet.object || !planet.object.position) {
            console.warn("Planet missing essential properties");
            return false;
        }
        
        // Ensure objects array exists
        if (!planet.objects) {
            console.log(`Initializing empty objects array for planet ${planet.name || "unnamed"}`);
            planet.objects = [];
        }
        
        // Ensure CoF (Coefficient of Friction) exists
        if (typeof planet.CoF !== 'number') {
            planet.CoF = 0.2; // Default friction value
        }
        
        return true;
    }

    // ADDED: New utility function to ensure object is positioned properly on planet
    static ensureObjectOnPlanetRadius(object, planetOverride = null) {
        if (!object || !object.userData) return false;
        
        try {
            // Get planet from object or from override
            const planet = planetOverride || object.userData.planet;
            if (!planet || !planet.object || !planet.radius) return false;
            
            const planetCenter = planet.object.position;
            const toObject = object.position.clone().sub(planetCenter);
            const currentDistance = toObject.length();
            const surfaceNormal = toObject.normalize();
            
            // Get appropriate height offset
            let heightOffset = 0;
            if (object.userData.type === 'car') {
                heightOffset = object.userData.fixedHeightOffset || 1.94;
            } else if (object.userData.type === 'wall') {
                // Walls should have their base exactly on the surface
                heightOffset = (object.userData.wallHeight || 0) / 2;
            } else {
                // Default small offset to prevent z-fighting
                heightOffset = 0.1;
            }
            
            // Calculate target height
            const targetHeight = planet.radius + heightOffset;
            
            // If object isn't at correct height, fix it
            if (Math.abs(currentDistance - targetHeight) > 0.01) {
                object.position.copy(planetCenter).addScaledVector(surfaceNormal, targetHeight);
                object.userData.surfaceNormal = surfaceNormal;
                
                // Also ensure object is properly oriented to planet
                if (object.up) {
                    object.up.copy(surfaceNormal);
                }
                
                return true; // Position was corrected
            }
            
            return false; // No correction needed
        } catch (err) {
            console.error("Error in ensureObjectOnPlanetRadius:", err);
            return false;
        }
    }

    // ADDED: Helper method to update non-vehicle objects only
    static updateNonVehicles() {
        try {
            // Handle player physics - skip if in vehicle
            PlayersManager.players.forEach(player => {
                if (!player || player.inVehicle) return;
                
                // Process player physics normally...
                // (code similar to regular update but skipping vehicle sections)
            });
            
            // Process non-vehicle physics objects
            for (const collidable of ObjectManager.collidableObjects) {
                if (!collidable || !collidable.active || collidable.isStatic) continue;
                if (collidable.type === 'player') continue;
                if (collidable.type === 'vehicle') continue; // Skip vehicles
                
                if (collidable.object && collidable.object.userData && collidable.object.userData.planet) {
                    // For any object on a planet, ensure it respects the planet radius
                    this.ensureObjectOnPlanetRadius(collidable.object);
                    
                    // Update object's collision bounds
                    ObjectManager.updateCollidableBounds(collidable.object);
                }
            }
            
            // Still update player colliders
            PlayersManager.updatePlayerColliders();
        } catch (err) {
            console.error("Error in updateNonVehicles:", err);
        }
    }
};
