import { Quaternion, Vector3, Matrix4, Euler } from 'three';
import PlayersManager from '../players.mjs';
import Engine from '../engine.mjs';

export default class FPSController {
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        jump: false
    };

    static pitch = 0;

    static reset() {
        const handle = PlayersManager.self;
        const player = handle.player;
        Engine.camera.position.set(0, 0, 0);
        Engine.camera.rotation.set(0, 0, 0);
        // Always attach camera to player (inner cube)
        player.add(Engine.camera);
        this.pitch = 0;
    }

    static update() {
        const handle = PlayersManager.self;
        const player = handle.player;
        const up = handle.position.clone().sub(handle.soi.position).normalize();

        if (handle.falling) {
            // Free rotation in space
            player.rotation.set(0, 0, 0);
            
            if (this.input.movement.length() > 0) {
                const move = this.input.movement.normalize().multiplyScalar(0.5);
                handle.position.add(move.applyQuaternion(handle.quaternion));
            }
            
            if (this.input.rotation.length() > 0) {
                handle.rotateY(-this.input.rotation.x);
                handle.rotateX(-this.input.rotation.y);
            }
        } else {
            if (this.input.rotation.length() > 0) {
                if (this.input.rotation.x) {
                    // Calculate pivot point at handle's base
                    const planetRadius = handle.soi.geometry.parameters.radius;
                    const feetPos = handle.soi.position.clone().add(
                        up.multiplyScalar(planetRadius)
                    );

                    // Get current forward direction for rotation
                    const currentForward = new Vector3(0, 0, -1)
                        .applyQuaternion(handle.quaternion)
                        .projectOnPlane(up)
                        .normalize();

                    // Move to feet, rotate handle, then move back
                    const toFeet = handle.position.clone().sub(feetPos);
                    handle.position.copy(feetPos);
                    
                    // Rotate around surface normal
                    handle.rotateOnWorldAxis(up, -this.input.rotation.x);
                    
                    // Move back while maintaining height
                    handle.position.add(toFeet.applyQuaternion(
                        new Quaternion().setFromAxisAngle(up, -this.input.rotation.x)
                    ));
                }
                
                if (this.input.rotation.y) {
                    // Only pitch the player inside for looking up/down
                    const newPitch = this.pitch - this.input.rotation.y;
                    this.pitch = Math.max(-Math.PI * 0.4, Math.min(Math.PI * 0.4, newPitch));
                    player.rotation.x = this.pitch;
                }
            }

            // Handle movement using handle's orientation
            if (this.input.movement.length() > 0) {
                const forward = new Vector3(0, 0, -1)
                    .applyQuaternion(handle.quaternion)
                    .projectOnPlane(up)
                    .normalize();
                const right = new Vector3().crossVectors(up, forward).normalize();
                
                const move = this.input.movement.normalize().multiplyScalar(0.5);
                const moveVector = new Vector3()
                    .addScaledVector(right, -move.x)
                    .addScaledVector(forward, -move.z);

                // Move along surface
                const radius = handle.soi.geometry.parameters.radius + 0.5;
                const targetPos = handle.position.clone().add(moveVector);
                const toCenter = targetPos.clone().sub(handle.soi.position);
                handle.position.copy(handle.soi.position).add(
                    toCenter.normalize().multiplyScalar(radius)
                );
            }

            // Keep handle aligned to surface
            const alignQuat = new Quaternion().setFromUnitVectors(
                new Vector3(0, 1, 0),
                up
            );
            handle.quaternion.copy(alignQuat);
        }

        // Handle jump
        if (this.input.jump && handle.grounded) {
            handle.velocity = up.multiplyScalar(10);
            handle.falling = true;
            handle.grounded = false;
        }

        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.jump = false;
    }

    static onLanding() {
        const handle = PlayersManager.self;
        const player = handle.player;
        const up = handle.position.clone().sub(handle.soi.position).normalize();
        
        // Align handle to surface smoothly
        const alignQuat = new Quaternion().setFromUnitVectors(
            new Vector3(0, 1, 0),
            up
        );
        handle.quaternion.copy(alignQuat);
        
        // Preserve player's world rotation
        const worldQuat = player.getWorldQuaternion(new Quaternion());
        player.quaternion.copy(worldQuat);
        
        // Reset pitch only
        this.pitch = 0;
        player.rotation.x = 0;
    }
}