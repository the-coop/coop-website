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
        const player = PlayersManager.self;
        Engine.camera.position.set(0, 0.3, 0);
        Engine.camera.rotation.set(0, 0, 0);
        player.add(Engine.camera);
        this.pitch = 0;
    }

    static update() {
        const player = PlayersManager.self;
        const up = player.position.clone().sub(player.soi.position).normalize();

        if (player.falling) {
            // In space: player cube rotates freely with camera
            if (this.input.movement.length() > 0) {
                const move = this.input.movement.normalize().multiplyScalar(0.5);
                player.position.add(move.applyQuaternion(player.quaternion));
            }
            
            if (this.input.rotation.length() > 0) {
                player.rotateY(-this.input.rotation.x);  // Yaw
                player.rotateX(-this.input.rotation.y);  // Pitch
            }
        } else {
            // On surface: player rotates horizontally, camera pitches vertically
            if (this.input.movement.length() > 0) {
                const forward = new Vector3(0, 0, -1)
                    .applyQuaternion(player.quaternion)
                    .projectOnPlane(up)
                    .normalize();
                const right = forward.cross(up).normalize();
                
                const move = this.input.movement.normalize().multiplyScalar(0.5);
                const moveVector = new Vector3()
                    .addScaledVector(right, move.x)
                    .addScaledVector(forward, move.z);
                
                player.position.add(moveVector);
            }
            
            if (this.input.rotation.length() > 0) {
                // Yaw - rotate player around surface normal
                if (this.input.rotation.x) {
                    player.rotateOnWorldAxis(up, -this.input.rotation.x);
                }
                
                // Pitch - only camera within limits
                if (this.input.rotation.y) {
                    this.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, 
                        this.pitch + this.input.rotation.y));
                    Engine.camera.rotation.x = this.pitch;
                }
            }

            // Keep player aligned to surface
            const playerUp = new Vector3(0, 1, 0).applyQuaternion(player.quaternion);
            if (playerUp.dot(up) < 0.99) {
                const alignQuat = new Quaternion().setFromUnitVectors(playerUp, up);
                player.quaternion.premultiply(alignQuat);
            }
        }

        // Handle jump
        if (this.input.jump && player.grounded) {
            player.velocity = up.multiplyScalar(10);
        }

        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.jump = false;
    }

    static onLanding() {
        const player = PlayersManager.self;
        const up = player.position.clone().sub(player.soi.position).normalize();
        
        // Align player to surface maintaining forward direction
        const forward = new Vector3(0, 0, -1)
            .applyQuaternion(player.quaternion)
            .projectOnPlane(up)
            .normalize();
        const right = forward.cross(up).normalize();
        
        const m = new Matrix4().makeBasis(right, up, forward.cross(right));
        player.quaternion.setFromRotationMatrix(m);
        
        // Reset camera to horizon
        Engine.camera.rotation.set(0, 0, 0);
        this.pitch = 0;
    }
}