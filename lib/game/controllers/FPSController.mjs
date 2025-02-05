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
        // Fixed camera position at eye level
        Engine.camera.position.set(0, 0.8, 0);
        Engine.camera.rotation.set(0, 0, 0);
        player.add(Engine.camera);
    }

    static update() {
        const player = PlayersManager.self;
        const up = player.position.clone().sub(player.soi.position).normalize();

        if (player.falling) {
            if (this.input.movement.length() > 0) {
                const move = this.input.movement.normalize().multiplyScalar(0.5);
                player.position.add(move.applyQuaternion(player.quaternion));
            }
            
            if (this.input.rotation.length() > 0) {
                player.rotateY(-this.input.rotation.x);
                player.rotateX(-this.input.rotation.y); // Invert pitch rotation while falling
            }
        } else {
            // Handle rotation first
            if (this.input.rotation.length() > 0) {
                // Yaw - rotate player around up vector
                if (this.input.rotation.x) {
                    // Store current forward direction
                    const currentForward = new Vector3(0, 0, -1)
                        .applyQuaternion(player.quaternion);
                    
                    // Create rotation quaternion around up vector
                    const yawQuat = new Quaternion()
                        .setFromAxisAngle(up, -this.input.rotation.x);
                    
                    // Apply rotation
                    player.quaternion.premultiply(yawQuat);
                    
                    // Re-align to surface
                    const newForward = currentForward
                        .applyQuaternion(yawQuat)
                        .projectOnPlane(up)
                        .normalize();
                    const right = new Vector3().crossVectors(up, newForward).normalize();
                    
                    const m = new Matrix4().makeBasis(
                        right,
                        up,
                        newForward.cross(right)
                    );
                    player.quaternion.setFromRotationMatrix(m);
                }
                
                // Pitch - camera only
                if (this.input.rotation.y) {
                    const newPitch = this.pitch - this.input.rotation.y;
                    this.pitch = Math.max(-Math.PI * 0.4, Math.min(Math.PI * 0.4, newPitch));
                    Engine.camera.rotation.x = this.pitch;
                }
            }

            if (this.input.movement.length() > 0) {
                // Use camera's forward direction for movement
                const cameraDir = new Vector3();
                Engine.camera.getWorldDirection(cameraDir);
                const forward = cameraDir.projectOnPlane(up).normalize();
                const right = new Vector3().crossVectors(up, forward).normalize();
                
                const move = this.input.movement.normalize().multiplyScalar(0.5);
                const moveVector = new Vector3()
                    .addScaledVector(right, -move.x)
                    .addScaledVector(forward, -move.z);
                
                // Move along surface
                player.position.add(moveVector);
                
                // Ensure exact distance from planet center
                const toCenter = player.position.clone().sub(player.soi.position);
                const radius = player.soi.geometry.parameters.radius;
                toCenter.normalize().multiplyScalar(radius + 0.5); // Half height offset
                player.position.copy(player.soi.position).add(toCenter);
            }
        }

        // Handle jump
        if (this.input.jump && player.grounded) {
            player.velocity = up.multiplyScalar(10);
            player.falling = true;
            player.grounded = false;
        }

        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.jump = false;
    }

    static onLanding() {
        const player = PlayersManager.self;
        const up = player.position.clone().sub(player.soi.position).normalize();
        
        // Align to surface while maintaining forward direction
        const forward = new Vector3(0, 0, -1).applyQuaternion(player.quaternion);
        const right = new Vector3().crossVectors(up, forward).normalize();
        const newForward = new Vector3().crossVectors(right, up);
        
        const m = new Matrix4().makeBasis(right, up, newForward);
        player.quaternion.setFromRotationMatrix(m);
        
        // Keep current pitch when landing
        Engine.camera.rotation.set(this.pitch, 0, 0);
    }
}