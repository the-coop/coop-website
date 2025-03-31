import SceneManager from './scene.mjs';
import PlayersManager from './players.mjs';
import ControlManager from './control.mjs';
import ObjectManager from './object.mjs';
import VehicleManager from './vehicles.mjs';
import { Vector3, Box3 } from 'three'; // Ensure Box3 is imported

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
            // CRITICAL FIX: Skip physics for the player's current vehicle
            // This prevents double movement as CarController already handles movement
            if (vehicle === VehicleManager.currentVehicle && vehicle.userData.isOccupied) {
                // For the current vehicle, only apply surface alignment, not movement
                if (vehicle.userData.type === 'car' && vehicle.userData.planet) {
                    // ENHANCED FIX: Completely skip alignment during stabilization period
                    if (vehicle.userData._stabilizationStarted) {
                        return;
                    }
                    
                    const planetCenter = vehicle.userData.planet.object.position;
                    const toVehicle = vehicle.position.clone().sub(planetCenter);
                    const surfaceNormal = toVehicle.normalize();
                    
                    // Only apply minimal alignment to avoid conflicts with CarController
                    // Use a very small factor to avoid fighting with the controller
                    VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.1);
                }
                return;
            }

            // Continue with normal physics for non-player vehicles
            if (!vehicle.userData.velocity) {
                vehicle.userData.velocity = new Vector3(0, -0.05, 0);
            }

            if (!vehicle.userData.planet) {
                vehicle.userData.planet = this.calculateSOI(vehicle.position);
            }
            const planet = vehicle.userData.planet;
            if (!planet) return;

            const planetCenter = planet.object.position;
            const toVehicle = vehicle.position.clone().sub(planetCenter);
            const distance = toVehicle.length();
            const surfaceNormal = toVehicle.normalize();

            const heightOffset = vehicle.userData.type === 'car' ? 1.5 : 2;
            const collisionDistance = planet.radius + heightOffset;

            if (vehicle.userData.falling === undefined) {
                const distanceAboveSurface = distance - planet.radius;
                const fallThreshold = vehicle.userData.type === 'car' ? 3.0 : 2.0;
                vehicle.userData.falling = (distanceAboveSurface > fallThreshold);
                vehicle.userData.onSurface = !vehicle.userData.falling;
                vehicle.userData._checkedForLanding = !vehicle.userData.falling;
                console.log(`Initialized vehicle ${vehicle.userData.name} falling state: ${vehicle.userData.falling}`);
            }

            const heightAboveSurface = distance - planet.radius;
            const fallThreshold = vehicle.userData.onSurface ? 
                heightOffset * 1.5 : 
                heightOffset * 1.1;

            const onSurface = heightAboveSurface <= fallThreshold;

            if (vehicle.userData.type === 'car' && 
                Math.abs(vehicle.userData.speed) < 0.1 && 
                heightAboveSurface <= heightOffset * 2) {

                vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, collisionDistance);
                vehicle.userData.velocity.set(0, 0, 0);
                vehicle.userData.falling = false;
                vehicle.userData.onSurface = true;
                vehicle.userData._checkedForLanding = true;
                vehicle.userData._stabilizeUntil = Date.now() + 500;
            }

            if (vehicle.userData.type === 'car' && onSurface) {
                const horizontalPos = vehicle.position.clone();
                const toSurface = horizontalPos.clone().sub(planetCenter).normalize();

                const currentDistance = vehicle.position.distanceTo(planetCenter);
                if (Math.abs(currentDistance - collisionDistance) > 0.5) {
                    const heightDelta = collisionDistance - currentDistance;
                    vehicle.position.addScaledVector(surfaceNormal, heightDelta);
                    console.log(`🚗 Adjusted car height only, preserving horizontal position`);
                }

                if (!vehicle.userData.isOccupied && Math.abs(vehicle.userData.speed) < 0.01) {
                    vehicle.userData.velocity.set(0, 0, 0);
                    vehicle.userData.speed = 0;
                } else if (vehicle.userData.isOccupied) {
                    const downVelocity = vehicle.userData.velocity.dot(surfaceNormal);
                    vehicle.userData.velocity.addScaledVector(surfaceNormal, -downVelocity);
                    console.log(`🚗 Preserving horizontal velocity: ${vehicle.userData.velocity.toArray()}`);
                }

                vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, collisionDistance);
                VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.8);

                if (!vehicle.userData.isOccupied && (!vehicle.userData.speed || Math.abs(vehicle.userData.speed) < 0.1)) {
                    vehicle.userData.velocity.set(0, 0, 0);
                    if (Math.abs(vehicle.userData.speed) < 0.1) {
                        vehicle.userData.speed = 0;
                    }
                }

                vehicle.userData.falling = false;
                vehicle.userData.onSurface = true;

                if (vehicle.collidable) {
                    ObjectManager.updateCollidableBounds(vehicle);
                }

                return;
            }

            if (!onSurface) {
                if (!vehicle.userData.falling) {
                    vehicle.userData.falling = true;
                    vehicle.userData.onSurface = false;
                    vehicle.userData._checkedForLanding = false;
                    console.log(`Vehicle ${vehicle.userData.name} started falling from height ${heightAboveSurface.toFixed(2)}`);
                }

                vehicle.position.add(vehicle.userData.velocity);

                if (vehicle.userData.type === 'airplane') {
                    // Airplane lift code would go here
                }

                if (distance <= collisionDistance) {
                    if (!vehicle.userData._checkedForLanding) {
                        console.log(`Vehicle ${vehicle.userData.name} landing at height ${heightAboveSurface.toFixed(2)}`);
                        this.vehicleLanding(vehicle, surfaceNormal);
                        vehicle.userData._checkedForLanding = true;
                        vehicle.userData.falling = false;
                        vehicle.userData.onSurface = true;
                    }
                }
            } else {
                vehicle.userData.onSurface = true;

                if (vehicle.userData.falling) {
                    if (!vehicle.userData._checkedForLanding) {
                        console.log(`Vehicle ${vehicle.userData.name} landing at height ${heightAboveSurface.toFixed(2)}`);
                        this.vehicleLanding(vehicle, surfaceNormal);
                        vehicle.userData._checkedForLanding = true;
                    }
                    vehicle.userData.falling = false;
                }
            }

        } catch (e) {
            console.error("Error in vehicle physics:", e);
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

                vehicle.position.copy(planetCenter).addScaledVector(toVehicle, 
                    vehicle.userData.planet.radius + 1.5);

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
