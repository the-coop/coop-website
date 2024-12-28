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
        Engine.camera.position.set(0, 0, 0);
        Engine.camera.rotation.set(0, 0, 0);
        player.add(Engine.camera);
        this.pitch = 0;
    }

    static update() {
        const player = PlayersManager.self;
        const up = player.position.clone().sub(player.soi.position).normalize();

        if (player.falling) {
            // Free movement and rotation in space
            if (this.input.movement.length() > 0) {
                const move = this.input.movement.normalize().multiplyScalar(0.5);
                player.position.add(move.applyQuaternion(player.quaternion));
            }
            
            if (this.input.rotation.length() > 0) {
                player.rotateY(this.input.rotation.x);
                player.rotateX(this.input.rotation.y);
            }
        } else {
            // Surface movement
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
                
                // Maintain height above surface
                const radius = player.soi.geometry.parameters.radius + 0.5;
                const toCenter = player.position.clone().sub(player.soi.position);
                player.position.copy(player.soi.position)
                    .add(toCenter.normalize().multiplyScalar(radius));
            }
            
            // Surface-aligned rotation
            if (this.input.rotation.length() > 0) {
                // Yaw around surface normal
                if (this.input.rotation.x) {
                    player.rotateOnWorldAxis(up, this.input.rotation.x);
                }
                
                // Pitch with limits
                if (this.input.rotation.y) {
                    const forward = new Vector3(0, 0, -1).applyQuaternion(player.quaternion);
                    const right = forward.cross(up).normalize();
                    
                    const newPitch = Math.max(-Math.PI/3, Math.min(Math.PI/3, this.pitch + this.input.rotation.y));
                    const pitchDelta = newPitch - this.pitch;
                    this.pitch = newPitch;
                    
                    if (Math.abs(pitchDelta) > 0.001) {
                        player.rotateOnWorldAxis(right, pitchDelta);
                    }
                }
            }

            // Maintain surface alignment
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
        
        // Just align to surface tangent, maintaining relative forward direction
        const forward = new Vector3(0, 0, -1)
            .applyQuaternion(player.quaternion)
            .projectOnPlane(up)
            .normalize();
        const right = forward.cross(up).normalize();
        
        const m = new Matrix4().makeBasis(right, up, forward.cross(right));
        player.quaternion.setFromRotationMatrix(m);
        this.pitch = 0;
    }
}