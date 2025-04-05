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
            
            // Apply velocity to position (after collision handling)
            vehicle.position.add(vehicle.userData.velocity);
            
            // Detect landing on the planet surface
            // FIXED: Use consistent height offset
            const heightOffset = vehicle.userData.type === 'car' ? 2.0 : 3.0;
            const groundLevel = planet.radius + heightOffset;
            
            if (distance <= groundLevel) {
                // We've hit the ground - set position exactly on surface
                vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, groundLevel);
                
                // FIXED: Don't allow bouncing when landing - this was causing the glitchy movement
                if (vehicle.userData.falling) {
                    const impactSpeed = -vehicle.userData.velocity.dot(surfaceNormal);
                    
                    if (impactSpeed > 2.5) {
                        // Only bounce for significant impacts
                        const bounce = Math.min(0.2, 0.5 / impactSpeed); // Reduced bounce factor
                        vehicle.userData.velocity.addScaledVector(surfaceNormal, impactSpeed * bounce);
                        
                        // Add more damping to prevent continuous bouncing
                        vehicle.userData.velocity.multiplyScalar(0.7);
                    } else {
                        // Stop completely for gentle landings
                        vehicle.userData.velocity.multiplyScalar(0.4);
                        if (vehicle.userData.velocity.lengthSq() < 0.01) {
                            vehicle.userData.velocity.set(0, 0, 0);
                            vehicle.userData.falling = false;
                        }
                    }
                } else {
                    // Already on ground - use friction to slow down
                    const frictionFactor = 1.0 - (planet.CoF || 0.2);
                    
                    // Apply lateral friction (keeps movement along surface)
                    const normalVel = vehicle.userData.velocity.dot(surfaceNormal);
                    const normalComponent = surfaceNormal.clone().multiplyScalar(normalVel);
                    const lateralComponent = vehicle.userData.velocity.clone().sub(normalComponent);
                    
                    // Apply more friction to lateral movement
                    lateralComponent.multiplyScalar(frictionFactor);
                    vehicle.userData.velocity.copy(lateralComponent).add(normalComponent);
                    
                    // If very slow, just stop completely
                    if (vehicle.userData.velocity.lengthSq() < 0.01) {
                        vehicle.userData.velocity.set(0, 0, 0);
                    }
                }
                
                // Properly align with surface
                this.stabilizeVehicleOnSurface(vehicle, surfaceNormal);
                vehicle.userData.onSurface = true;
                
                // Mark as not falling when velocity becomes negligible
                if (vehicle.userData.velocity.lengthSq() < 0.04) {
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

    // NEW METHOD: Completely stabilize a vehicle on the surface
    static stabilizeVehicleOnSurface(vehicle, surfaceNormal) {
        if (!vehicle || !surfaceNormal) return;
        
        try {
            // Set vehicle's up vector to match surface normal
            vehicle.up.copy(surfaceNormal);
            
            // Align vehicle orientation properly with the surface
            if (vehicle.userData.type === 'car') {
                // Get current forward direction 
                const forward = new Vector3(0, 0, 1).applyQuaternion(vehicle.quaternion);
                
                // Project forward direction onto the tangent plane of the surface
                const projectedForward = forward.clone().projectOnPlane(surfaceNormal).normalize();
                
                if (projectedForward.lengthSq() > 0.001) {
                    // Create a right vector perpendicular to up and projected forward
                    const right = new Vector3().crossVectors(surfaceNormal, projectedForward).normalize();
                    
                    // Create a corrected forward vector perpendicular to both up and right
                    const correctedForward = new Vector3().crossVectors(right, surfaceNormal).normalize();
                    
                    // Create a target to look at along the corrected forward direction
                    const lookTarget = new Vector3().copy(vehicle.position).add(correctedForward);
                    
                    // Make the car look at this target with the up direction matching the surface normal
                    vehicle.up.copy(surfaceNormal);
                    
                    // IMPROVED: Use smooth transitions for occupied vehicles
                    if (vehicle.userData.isOccupied) {
                        const tempObj = new Object3D();
                        tempObj.position.copy(vehicle.position);
                        tempObj.up.copy(surfaceNormal);
                        tempObj.lookAt(lookTarget);
                        
                        // Use slerp for smoother rotation
                        vehicle.quaternion.slerp(tempObj.quaternion, 0.2);
                    } else {
                        // Directly set orientation for non-occupied vehicles
                        vehicle.lookAt(lookTarget);
                    }
                }
                
                // FIXED: Ensure car is at exactly the right height (2.0) above surface
                if (vehicle.userData.planet) {
                    const planetCenter = vehicle.userData.planet.object.position;
                    const toVehicle = vehicle.position.clone().sub(planetCenter);
                    const distance = toVehicle.length();
                    const surfaceNormal = toVehicle.normalize();
                    
                    const targetDistance = vehicle.userData.planet.radius + 2.0;
                    if (Math.abs(distance - targetDistance) > 0.05) {
                        vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, targetDistance);
                    }
                }
                
                // Reset wheels to default position for stability
                if (typeof VehicleManager.resetVehicleWheels === 'function' && !vehicle.userData.isOccupied) {
                    VehicleManager.resetVehicleWheels(vehicle);
                }
            }
        } catch (e) {
            console.error("Error stabilizing vehicle:", e);
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

                // FIXED: Use consistent 2.0 offset for the car landing (increased from 1.5)
                vehicle.position.copy(planetCenter).addScaledVector(toVehicle, 
                    vehicle.userData.planet.radius + 2.0);

                const up = toVehicle.clone();
                const projectedForward = originalForward.clone().projectOnPlane(up).normalize();
                const right = new Vector3().crossVectors(up, projectedForward).normalize();
                const correctedForward = new Vector3().crossVectors(right, up).normalize();

                vehicle.up.copy(up);
                const lookTarget = new Vector3().copy(vehicle.position).add(correctedForward);
                vehicle.lookAt(lookTarget);

                vehicle.userData.velocity.set(0, 0, 0);
                vehicle.userData._stabilizeUntil = Date.now() + 800;
                vehicle.userData.speed *= 0.05;
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
