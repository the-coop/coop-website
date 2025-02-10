import { Quaternion, Vector3, Euler } from 'three';
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
        jump: false
    };

    // Track player's view angles for ground movement
    static eulerAngles = new Euler(0, 0, 0, 'YXZ');  // YXZ order matches natural view rotation

    // Camera may need detaching or transitions to other controllers.
    static reset() {
        // Position camera at eye level, looking forward
        Engine.camera.position.set(0, 0.5, 0);
        Engine.camera.quaternion.set(0, 0, 0, 1);
        // Attach camera to mesh for smoother movement
        PlayersManager.self.mesh.add(Engine.camera);
    };

    static falling() {
        // In space: Apply rotations to aim first
        const rotX = new Quaternion().setFromAxisAngle(
            new Vector3(0, 1, 0),
            this.input.rotation.x
        );
        const rotY = new Quaternion().setFromAxisAngle(
            new Vector3(1, 0, 0),
            this.input.rotation.y
        );
        
        // Update aim quaternion
        PlayersManager.self.aim.multiply(rotX).multiply(rotY);
        
        // Make handle and camera follow aim exactly in space
        PlayersManager.self.handle.quaternion.copy(PlayersManager.self.aim);
        Engine.camera.quaternion.copy(PlayersManager.self.aim);
    }

    static grounded() {
        // Handle only rotates left/right (yaw)
        if (this.input.rotation.x !== 0) {
            const yawRotation = new Quaternion().setFromAxisAngle(
                new Vector3(0, 1, 0),
                this.input.rotation.x
            );
            PlayersManager.self.handle.quaternion.multiply(yawRotation);
        }

        // Camera handles up/down independently (pitch)
        this.eulerAngles.x += this.input.rotation.y;
        this.eulerAngles.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.eulerAngles.x));
        
        // Apply pitch to camera directly
        Engine.camera.quaternion.setFromEuler(new Euler(this.eulerAngles.x, 0, 0));
        // Combine with handle's rotation
        Engine.camera.quaternion.multiply(PlayersManager.self.handle.quaternion);
    }

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

    // Aligns player with planet surface on landing
    // This creates a smooth transition from space to surface movement
    static landing(upVector) {
        // Reset pitch
        this.eulerAngles.set(0, 0, 0);
        
        // Align handle with surface
        const surfaceAlignment = new Quaternion();
        surfaceAlignment.setFromUnitVectors(new Vector3(0, 1, 0), upVector);
        PlayersManager.self.handle.quaternion.copy(surfaceAlignment);
        
        // Reset camera to match handle
        Engine.camera.quaternion.copy(surfaceAlignment);
    };

};