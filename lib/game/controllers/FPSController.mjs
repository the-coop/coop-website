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
        // Position camera inside player mesh
        Engine.camera.position.set(0, 0.3, 0);
        Engine.camera.rotation.set(0, 0, 0);
        player.add(Engine.camera);
        this.pitch = 0;
    }

    static update() {
        const handle = PlayersManager.self;
        const player = handle.player;
        const up = handle.position.clone().sub(handle.soi.position).normalize();
        const planetRadius = handle.soi.geometry.parameters.radius;

        if (handle.falling) {
            // In space, player follows handle completely
            if (Engine.camera.parent !== player) {
                player.add(Engine.camera);
                Engine.camera.position.set(0, 0.3, 0);
                Engine.camera.rotation.set(this.pitch, 0, 0);
            }
            player.quaternion.copy(handle.quaternion);
            
            if (this.input.rotation.length() > 0) {
                handle.rotateY(-this.input.rotation.x);
                handle.rotateX(-this.input.rotation.y);
                player.quaternion.copy(handle.quaternion);
            }
            
            // Space movement
            if (this.input.movement.length() > 0) {
                const move = this.input.movement.normalize().multiplyScalar(0.5);
                handle.position.add(move.applyQuaternion(handle.quaternion));
            }
        } else {
            // When grounded, camera attaches to handle for aiming
            if (Engine.camera.parent !== handle) {
                handle.add(Engine.camera);
                Engine.camera.position.set(0, 0.7, 0);
                Engine.camera.rotation.set(this.pitch, 0, 0);
            }

            // Keep player mesh aligned to surface only, no additional rotation
            const surfaceAlign = new Quaternion().setFromUnitVectors(
                new Vector3(0, 1, 0),
                up
            );
            player.quaternion.copy(surfaceAlign);

            // Handle can rotate independently for aiming
            if (this.input.rotation.length() > 0) {
                if (this.input.rotation.x) {
                    // Only handle rotates, keeping feet position
                    const feetPos = handle.soi.position.clone().add(
                        up.multiplyScalar(planetRadius)
                    );
                    const toFeet = handle.position.clone().sub(feetPos);
                    
                    handle.position.copy(feetPos);
                    const rotationQuat = new Quaternion().setFromAxisAngle(up, this.input.rotation.x);
                    handle.quaternion.copy(surfaceAlign).premultiply(rotationQuat);
                    handle.position.add(toFeet.applyQuaternion(rotationQuat));
                }
                
                if (this.input.rotation.y) {
                    const newPitch = this.pitch - this.input.rotation.y;
                    this.pitch = Math.max(-Math.PI * 0.35, Math.min(Math.PI * 0.35, newPitch));
                    Engine.camera.rotation.set(this.pitch, 0, 0);
                }
            } else {
                // Reset handle alignment when not rotating
                handle.quaternion.copy(surfaceAlign);
            }

            // Movement using handle direction
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
                
                // Move and maintain surface contact
                handle.position.add(moveVector);
                const toCenter = handle.position.clone().sub(handle.soi.position);
                handle.position.copy(handle.soi.position).add(
                    toCenter.normalize().multiplyScalar(planetRadius + 0.5)
                );

                // Re-align player mesh after movement
                player.quaternion.copy(surfaceAlign);
            }
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
        
        // Align handle and player to surface
        const alignQuat = new Quaternion().setFromUnitVectors(
            new Vector3(0, 1, 0),
            up
        );
        handle.quaternion.copy(alignQuat);
        player.quaternion.copy(alignQuat);
        
        // Move camera to handle and reset rotation
        handle.add(Engine.camera);
        Engine.camera.position.set(0, 0.7, 0);
        Engine.camera.rotation.set(0, 0, 0);
        this.pitch = 0;
    }
}