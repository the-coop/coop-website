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

    // Camera reset with improved handling for vehicle transitions
    static reset() {
        console.log('FPSController reset called');
        
        if (!PlayersManager.self) {
            console.warn('FPSController.reset called but no player exists');
            return;
        }
        
        try {
            // IMPROVED: Set stage flag to track state
            const isTransitioningFromVehicle = PlayersManager.self.inVehicle;
            
            // CRITICAL FIX: Make sure we have a clean slate
            // Clear vehicle state
            PlayersManager.self.inVehicle = false;
            
            if (PlayersManager.self.handle && PlayersManager.self.handle.userData) {
                PlayersManager.self.handle.userData.inVehicle = false;
                PlayersManager.self.handle.userData.currentVehicle = null;
            }
            
            // IMPROVED: Check if player handle and mesh exist and are in the correct relationship
            if (PlayersManager.self.mesh && PlayersManager.self.handle) {
                // Make sure mesh is attached to handle if it isn't already
                if (PlayersManager.self.mesh.parent !== PlayersManager.self.handle) {
                    console.log("Reattaching player mesh to handle");
                    if (PlayersManager.self.mesh.parent) {
                        PlayersManager.self.mesh.parent.remove(PlayersManager.self.mesh);
                    }
                    PlayersManager.self.handle.add(PlayersManager.self.mesh);
                    PlayersManager.self.mesh.position.set(0, 0, 0);
                }
                
                // IMPROVED: Make sure player mesh is visible
                PlayersManager.self.mesh.visible = true;
                PlayersManager.self.handle.visible = true;
                
                // IMPROVED: If transitioning from vehicle, handle camera differently
                if (isTransitioningFromVehicle) {
                    // Get current camera world position and direction
                    const worldPos = new Vector3();
                    const worldQuat = new Quaternion();
                    
                    if (Engine.camera.parent) {
                        Engine.camera.getWorldPosition(worldPos);
                        Engine.camera.getWorldQuaternion(worldQuat);
                        Engine.camera.parent.remove(Engine.camera);
                    } else {
                        worldPos.copy(Engine.camera.position);
                        worldQuat.copy(Engine.camera.quaternion);
                    }
                    
                    // First add to scene to reset hierarchy
                    Engine.scene.add(Engine.camera);
                    
                    // Then attach to player mesh directly
                    PlayersManager.self.mesh.add(Engine.camera);
                    
                    // Set position directly above player
                    Engine.camera.position.set(0, 1, 0);
                    
                    // IMPROVED: Start with camera pointing in the same world direction
                    // to prevent jarring camera jumps
                    const forward = new Vector3(0, 0, -1).applyQuaternion(worldQuat);
                    const tempQuat = new Quaternion().setFromUnitVectors(
                        new Vector3(0, 0, 1), 
                        forward.clone().negate()
                    );
                    Engine.camera.quaternion.copy(tempQuat);
                    
                    // IMPROVED: Keep correct up vector
                    if (PlayersManager.self.surfaceNormal) {
                        Engine.camera.up.copy(PlayersManager.self.surfaceNormal);
                    } else {
                        Engine.camera.up.set(0, 1, 0);
                    }
                    
                    console.log('Camera positioned in FPS view from vehicle transition');
                } else {
                    // Standard camera attachment for non-transition cases
                    if (Engine.camera.parent) {
                        Engine.camera.parent.remove(Engine.camera);
                    }
                    
                    PlayersManager.self.mesh.add(Engine.camera);
                    Engine.camera.position.set(0, 1, 0);
                    Engine.camera.rotation.set(0, 0, 0);
                    
                    if (PlayersManager.self.surfaceNormal) {
                        Engine.camera.up.copy(PlayersManager.self.surfaceNormal);
                    } else {
                        Engine.camera.up.set(0, 1, 0);
                    }
                    
                    console.log('Camera positioned in FPS view (standard)');
                }
                
                // Reset pitch to 0 (straight ahead)
                this.surfacePitch = 0;
            } else {
                console.error('Missing player components');
            }
            
            // Reset input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.jump = false;
            this.input.landedFrames = 0;
            
            console.log("FPSController reset complete");
        } catch (e) {
            console.error('Error in FPSController reset:', e);
        }
    }

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
            const airControlSpeed = 0.03; // FURTHER REDUCED from 0.04 to 0.03 (70% slower than original)
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
            const groundMoveSpeed = 0.15; // FURTHER REDUCED from 0.2 to 0.15 (70% slower than original)
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
        
        // IMPROVED: Double-check vehicle relationship is cleared
        PlayersManager.self.inVehicle = false;
        if (PlayersManager.self.handle && PlayersManager.self.handle.userData) {
            PlayersManager.self.handle.userData.inVehicle = false;
            PlayersManager.self.handle.userData.currentVehicle = null;
        }
    };

};