import { Quaternion, Vector3, Euler, Matrix4 } from 'three';
import PlayersManager from '../players.mjs';
import Engine from '../engine.mjs';
import FPSController from './FPSController.mjs';

export default class ThirdPersonController {
    // Input adapter that standardizes different input methods
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        jump: false,
        landedFrames: 0
    };

    // Third-person camera configuration
    static cameraDistance = 5;
    static cameraHeight = 2;
    static cameraLookOffset = 0;

    // Ground aiming Pitch (YXZ order matches natural view rotation).
    static surfacePitch = 0;  

    // Initialize the controller
    static reset() {
        console.log('ThirdPersonController reset called');
        
        if (!PlayersManager.self) {
            console.warn('ThirdPersonController.reset called but no player exists');
            return;
        }
        
        try {
            // First, check if player exists and has necessary components
            console.log('Player exists:', {
                position: PlayersManager.self.position?.toArray() || 'missing',
                hasHandle: !!PlayersManager.self.handle,
                hasMesh: !!PlayersManager.self.mesh
            });
            
            // Force camera to scene first to avoid any parenting issues
            if (Engine.camera.parent) {
                console.log('Detaching camera from', Engine.camera.parent.type || Engine.camera.parent.uuid);
                const worldPos = new Vector3();
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
            }
            
            // Make sure mesh is attached to handle
            if (PlayersManager.self.mesh && PlayersManager.self.handle) {
                if (PlayersManager.self.mesh.parent !== PlayersManager.self.handle) {
                    console.log('Reattaching player mesh to handle');
                    if (PlayersManager.self.mesh.parent) {
                        PlayersManager.self.mesh.parent.remove(PlayersManager.self.mesh);
                    }
                    PlayersManager.self.handle.add(PlayersManager.self.mesh);
                    PlayersManager.self.mesh.position.set(0, 0, 0);
                }
                
                // For third-person, camera should be a scene child, not player child
                console.log('Setting up third-person camera');
                if (Engine.camera.parent !== Engine.scene) {
                    if (Engine.camera.parent) {
                        Engine.camera.parent.remove(Engine.camera);
                    }
                    Engine.scene.add(Engine.camera);
                }
                
                // Position camera behind player
                this.updateCameraPosition();
            } else {
                console.error('Missing player components:', {
                    hasMesh: !!PlayersManager.self.mesh,
                    hasHandle: !!PlayersManager.self.handle
                });
            }
            
            // Reset input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.jump = false;
            this.input.landedFrames = 0;
            
            console.log('ThirdPersonController reset complete');
        } catch (e) {
            console.error('Error in ThirdPersonController reset:', e);
        }
    }

    // Update the camera position to be behind the player
    static updateCameraPosition() {
        if (!PlayersManager.self || !PlayersManager.self.handle) return;
        
        // Get player position and rotation
        const playerPos = PlayersManager.self.position.clone();
        const playerRot = PlayersManager.self.handle.quaternion.clone();
        
        // Calculate camera position behind player
        const cameraOffset = new Vector3(0, this.cameraHeight, this.cameraDistance);
        cameraOffset.applyQuaternion(playerRot);
        
        // Position camera
        Engine.camera.position.copy(playerPos).sub(cameraOffset);
        
        // Look at player plus a slight height offset
        const lookTarget = playerPos.clone().add(new Vector3(0, this.cameraLookOffset, 0));
        Engine.camera.lookAt(lookTarget);
    }

    // Same falling logic as FPSController
    static falling() {
        // Use the same falling logic as FPSController
        FPSController.falling.call(this);
        
        // Update camera position after player moves
        this.updateCameraPosition();
    }

    // Similar to FPSController's grounded but adapted for third-person
    static grounded() {
        // Handle player rotation based on input
        this.surfacePitch = Math.max(
            -Math.PI * 0.4,
            Math.min(Math.PI * 0.45, this.surfacePitch + this.input.rotation.y)
        );

        if (this.input.landedFrames > 0) this.input.landedFrames--;
        
        const surfaceNormal = PlayersManager.self.surfaceNormal;
        const viewDirection = new Vector3(0, 0, 1).applyQuaternion(PlayersManager.self.handle.quaternion);
        const rightVector = new Vector3().crossVectors(surfaceNormal, viewDirection).normalize();

        // Calculate surface-aligned rotation
        const horizontalRotation = this.input.rotation.x;
        const desiredDirection = new Vector3()
            .addScaledVector(viewDirection, Math.cos(horizontalRotation))
            .addScaledVector(rightVector, Math.sin(horizontalRotation))
            .projectOnPlane(surfaceNormal)
            .normalize()
            .add(PlayersManager.self.handle.getWorldPosition(new Vector3()));

        PlayersManager.self.handle.up.copy(surfaceNormal);
        PlayersManager.self.handle.lookAt(desiredDirection);

        // In third person, we don't rotate the camera itself on pitch
        // The camera position will be updated in the main update method

        // Movement logic same as FPS controller
        if (this.input.movement.lengthSq() > 0) {
            const groundMoveSpeed = 0.5;
            const desiredMovement = this.input.movement.normalize().multiplyScalar(groundMoveSpeed);
            const worldSpaceMovement = desiredMovement.applyQuaternion(PlayersManager.self.handle.quaternion);
            PlayersManager.self.velocity.add(worldSpaceMovement);
        }

        if (this.input.jump && this.input.landedFrames == 0) {
            const jumpForce = surfaceNormal.clone().multiplyScalar(8);
            PlayersManager.self.velocity.multiplyScalar(0.5);
            PlayersManager.self.velocity.add(jumpForce);
            this.input.landedFrames = 10;
        }
        
        // Update camera position after player moves
        this.updateCameraPosition();
    }

    // Main update method
    static update() {
        // Choose aiming mode based on falling state
        PlayersManager.self.falling ? 
            this.falling() : 
            this.grounded();

        // Reset input for next frame
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.jump = false;
        
        return null; // No controller exit request
    }

    // Use same landing transition as FPS
    static landing(up) {
        FPSController.landing.call(this, up);
        this.updateCameraPosition();
    }

    // Use same liftoff transition as FPS
    static liftoff() {
        FPSController.liftoff.call(this);
        this.updateCameraPosition();
    }

    // Cleanup when switching away from this controller
    static cleanup() {
        console.log('ThirdPersonController cleanup');
        
        // Nothing special to clean up - camera is scene child
        // and will be managed by the next controller
    }
}
