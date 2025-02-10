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
        // In space: Handle rotates based on input
        const rotX = new Quaternion().setFromAxisAngle(
            new Vector3(0, 1, 0),
            this.input.rotation.x
        );
        const rotY = new Quaternion().setFromAxisAngle(
            new Vector3(1, 0, 0),
            this.input.rotation.y
        );
        
        // Update handle rotation and aim
        PlayersManager.self.handle.quaternion.multiply(rotX).multiply(rotY);
        PlayersManager.self.aim.copy(PlayersManager.self.handle.quaternion);
        
        // Camera is already attached to handle, no need to update its quaternion
    };

    static grounded() {
        // Handle rotates left/right based on yaw input
        if (this.input.rotation.x !== 0) {
            const yawRotation = new Quaternion().setFromAxisAngle(
                new Vector3(0, 1, 0),
                this.input.rotation.x
            );
            // Apply yaw to handle (which also rotates mesh and camera since they're children)
            PlayersManager.self.handle.quaternion.multiply(yawRotation);
        }

        // Camera pitch (up/down) handled separately
        this.eulerAngles.x = Math.max(
            -Math.PI/2, 
            Math.min(Math.PI/2, this.eulerAngles.x + this.input.rotation.y)
        );
        
        // Apply pitch directly to camera
        const pitchRotation = new Quaternion().setFromEuler(new Euler(this.eulerAngles.x, 0, 0));
        Engine.camera.quaternion.copy(pitchRotation);
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

    // Aligns player with planet surface on landing
    // This creates a smooth transition from space to surface movement
    static landing(upVector) {
        // Reset pitch but keep current yaw for smooth transition
        const currentYaw = this.eulerAngles.y;
        this.eulerAngles.set(0, currentYaw, 0);
        
        // Create surface alignment
        const surfaceAlignment = new Quaternion();
        surfaceAlignment.setFromUnitVectors(new Vector3(0, 1, 0), upVector);
        
        // Create yaw rotation to maintain handle's current spin
        const yawRotation = new Quaternion().setFromEuler(new Euler(0, currentYaw, 0));
        
        // Combine surface alignment with yaw rotation
        PlayersManager.self.handle.quaternion.copy(surfaceAlignment).multiply(yawRotation);
        PlayersManager.self.aim.copy(PlayersManager.self.handle.quaternion);
        
        // Camera will follow handle rotation automatically since it's attached
    };

};