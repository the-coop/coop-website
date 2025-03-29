import { Quaternion, Vector3, Euler, Matrix4 } from 'three';
import PlayersManager from '../players.mjs';
import Engine from '../engine.mjs';

export default class FPSController {
    // Input adapter that standardizes different input methods (keyboard/mouse, gamepad)
    // into a shared format that the FPS controller can process:
    // - movement: unified directional input (WASD/Stick)
    // - rotation: unified view changes (Mouse/Stick)
    // - jump: unified action button (Space/Button)
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        jump: false,
        landedFrames: 0
    };

    // Ground aiming Pitch (YXZ order matches natural view rotation).
    static surfacePitch = 0;  

    // Camera may need detaching or transitions to other controllers.
    static reset() {
        console.log('Resetting FPS Controller');
        
        if (!PlayersManager.self) {
            console.warn('FPSController.reset called but no player exists');
            return;
        }
        
        // Make sure mesh is attached to handle
        if (PlayersManager.self.mesh && PlayersManager.self.mesh.parent !== PlayersManager.self.handle) {
            console.log('Reattaching player mesh to handle');
            
            if (PlayersManager.self.mesh.parent) {
                PlayersManager.self.mesh.parent.remove(PlayersManager.self.mesh);
            }
            
            PlayersManager.self.handle.add(PlayersManager.self.mesh);
            PlayersManager.self.mesh.position.set(0, 0, 0);
        }
        
        // Explicitly set handle position from player position
        if (PlayersManager.self.handle && PlayersManager.self.position) {
            PlayersManager.self.handle.position.copy(PlayersManager.self.position);
        }
        
        // Step 1: Ensure camera is not already attached to anything unexpected
        // and detach it if necessary
        if (Engine.camera.parent && Engine.camera.parent !== PlayersManager.self.mesh) {
            console.log('Detaching camera from', Engine.camera.parent.type || 'unknown');
            
            // Save world position before detaching
            const worldPos = new Vector3();
            Engine.camera.getWorldPosition(worldPos);
            
            // Detach camera and add to scene temporarily
            Engine.camera.parent.remove(Engine.camera);
            Engine.scene.add(Engine.camera);
            Engine.camera.position.copy(worldPos);
        }
        
        // Step 2: Wait a frame to ensure all other updates are completed
        setTimeout(() => {
            if (!PlayersManager.self || !PlayersManager.self.mesh) return;
            
            // Now attach camera to player mesh with proper position
            if (Engine.camera.parent !== PlayersManager.self.mesh) {
                if (Engine.camera.parent) {
                    Engine.camera.parent.remove(Engine.camera);
                }
                
                PlayersManager.self.mesh.add(Engine.camera);
                
                // Position camera at eye level
                Engine.camera.position.set(0, 1, 0);
                Engine.camera.rotation.set(0, 0, 0);
                
                console.log('Camera attached to player mesh');
            }
            
            // Reset camera pitch angle
            Engine.camera.quaternion.setFromEuler(new Euler(this.surfacePitch, 0, 0));
        }, 0);
        
        // Reset input state 
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.jump = false;
        this.input.landedFrames = 0;
        
        console.log('FPSController reset complete');
    };

    static falling() {
        // Maintain orientation in space using world-aligned rotations
        const yawRotation = new Quaternion().setFromAxisAngle(
            new Vector3(0, 1, 0),
            this.input.rotation.x
        );
        const pitchRotation = new Quaternion().setFromAxisAngle(
            new Vector3(1, 0, 0),
            this.input.rotation.y
        );
        
        PlayersManager.self.handle.quaternion.multiply(yawRotation).multiply(pitchRotation);
        PlayersManager.self.aim.copy(PlayersManager.self.handle.quaternion);

        if (this.input.movement.lengthSq() > 0) {
            const airControlSpeed = 0.1;
            const desiredMovement = this.input.movement.normalize().multiplyScalar(airControlSpeed);
            const worldSpaceMovement = desiredMovement.applyQuaternion(PlayersManager.self.aim);
            PlayersManager.self.velocity.add(worldSpaceMovement);
        }
    };

    static grounded() {
        
        // Constrain vertical look limits (-72° to 81°)
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
        Engine.camera.quaternion.setFromEuler(new Euler(this.surfacePitch, 0, 0));

        if (this.input.movement.lengthSq() > 0) {
            const groundMoveSpeed = 0.5;
            const desiredMovement = this.input.movement.normalize().multiplyScalar(groundMoveSpeed);
            const worldSpaceMovement = desiredMovement.applyQuaternion(PlayersManager.self.handle.quaternion);
            PlayersManager.self.velocity.add(worldSpaceMovement);
        }

        if (this.input.jump && this.input.landedFrames == 0) {
            const jumpForce = surfaceNormal.clone().multiplyScalar(8); // Reduced jump force
            PlayersManager.self.velocity.multiplyScalar(0.5); // a slow down to stop the crazy speed from bunny hopping
            PlayersManager.self.velocity.add(jumpForce);
            this.input.landedFrames = 10;
        }
    };

    // Handles all rotation using quaternions:
    // - In space: Full 6DOF rotation following view direction
    // - On ground: Rotation relative to planet's surface normal
    static update() {
        // Choose aiming mode based on falling state
        PlayersManager.self.falling ? 
            this.falling() : 
            this.grounded();

        // Reset input for next frame
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.jump = false;
    };

    // This creates a smooth transition from space to surface movement
    static landing(up) {
        // Check how much its up or down, and convert it to an angle
        const forward = new Vector3(0, 0, -1).applyQuaternion(PlayersManager.self.handle.quaternion);
        const upFacing = forward.dot(up);

        // Dot product gives cos batween the vectors, but we want the direction forwards thats 90deg out so its sin
        const currentYaw = Math.asin(upFacing); 

        // Set the camera angle
        this.surfacePitch = Math.max(
            -Math.PI * 0.4,
            Math.min(Math.PI * 0.45, currentYaw)
        );
    };

    // This creates a smooth transition from surface movement to space
    static liftoff() {
        //get old rotation of camera
        const quaternion = new Quaternion();
        Engine.camera.getWorldQuaternion(quaternion);
        
        //set handle to camera rotation
        Engine.camera.quaternion.setFromEuler(new Euler(0, 0, 0));
        PlayersManager.self.handle.setRotationFromQuaternion(quaternion);
    };

};