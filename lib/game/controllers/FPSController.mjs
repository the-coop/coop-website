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
        // Position camera forward and up slightly from handle center
        Engine.camera.position.set(0, 0.5, -0.5);
        Engine.camera.quaternion.set(0, 0, 0, 1);
        // Attach camera directly to handle for consistent orientation
        PlayersManager.self.handle.add(Engine.camera);
    };

    static falling() {
        // In space: Rotate entire handle structure with aim
        const rotX = new Quaternion().setFromAxisAngle(
            new Vector3(0, 1, 0),
            this.input.rotation.x
        );
        const rotY = new Quaternion().setFromAxisAngle(
            new Vector3(1, 0, 0),
            this.input.rotation.y
        );
        
        // Update aim and apply to handle
        PlayersManager.self.aim.multiply(rotX).multiply(rotY);
        PlayersManager.self.handle.quaternion.copy(PlayersManager.self.aim);
        
        // Camera stays fixed relative to handle, no need to update its quaternion
    }

    static grounded() {
        // On ground: Handle only rotates left/right, camera handles up/down
        
        // Yaw: Rotate handle left/right around surface normal
        if (this.input.rotation.x !== 0) {
            const handleRotation = new Quaternion().setFromAxisAngle(
                new Vector3(0, 1, 0),
                this.input.rotation.x
            );
            PlayersManager.self.handle.quaternion.multiply(handleRotation);
        }

        // Pitch: Camera looks up/down independently
        this.eulerAngles.x += this.input.rotation.y;
        this.eulerAngles.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.eulerAngles.x));
        
        // Combine handle rotation with camera pitch
        const pitchRotation = new Quaternion().setFromEuler(new Euler(this.eulerAngles.x, 0, 0));
        PlayersManager.self.aim.copy(PlayersManager.self.handle.quaternion).multiply(pitchRotation);
    }

    // Handles all rotation using quaternions:
    // - In space: Full 6DOF rotation following view direction
    // - On ground: Rotation relative to planet's surface normal
    static update() {
        // Update aim based on movement state
        PlayersManager.self.falling ? 
            this.falling() : 
            this.grounded();
        
        // In falling state, camera follows handle rotation
        // In grounded state, camera gets additional pitch rotation
        if (!PlayersManager.self.falling)
            Engine.camera.quaternion.copy(PlayersManager.self.aim);
        
        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.jump = false;
    };

    // Aligns player with planet surface on landing
    // This creates a smooth transition from space to surface movement
    static landing(upVector, surfacePosition) {
        // Reset camera pitch
        this.eulerAngles.set(0, 0, 0);
        
        // Align handle with surface
        const surfaceAlignment = new Quaternion();
        surfaceAlignment.setFromUnitVectors(new Vector3(0, 1, 0), upVector);
        
        // Apply to both handle and aim
        PlayersManager.self.handle.quaternion.copy(surfaceAlignment);
        PlayersManager.self.aim.copy(surfaceAlignment);
        
        console.log('player landed at', surfacePosition);
    };

};