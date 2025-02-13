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
        canJump: true // Add jump availability flag
    };

    // Ground aiming (YXZ order matches natural view rotation).
    static groundedAim = new Euler(0, 0, 0, 'YXZ');  

    // Camera may need detaching or transitions to other controllers.
    static reset() {
        // Set initial camera position for FPS mode. 
        Engine.camera.position.set(0, 0.5, 0);
        Engine.camera.quaternion.set(0, 0, 0, 1);

        // Attach the camera to the mesh so aiming rotations can be simplified.
        PlayersManager.self.mesh.add(Engine.camera);
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
        this.groundedAim.y += this.input.rotation.x;  

        // Constrain vertical look limits (-72° to 81°)
        this.groundedAim.x = Math.max(               
            -Math.PI * 0.4,
            Math.min(Math.PI * 0.45, this.groundedAim.x + this.input.rotation.y)
        );

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
        Engine.camera.quaternion.setFromEuler(new Euler(this.groundedAim.x, 0, 0));

        if (this.input.movement.lengthSq() > 0) {
            const groundMoveSpeed = 0.5;
            const desiredMovement = this.input.movement.normalize().multiplyScalar(groundMoveSpeed);
            const worldSpaceMovement = desiredMovement.applyQuaternion(PlayersManager.self.handle.quaternion);
            PlayersManager.self.velocity.add(worldSpaceMovement);
        }

        if (this.input.jump && this.input.canJump) {
            const jumpForce = surfaceNormal.clone().multiplyScalar(3);
            PlayersManager.self.velocity.add(jumpForce);
            PlayersManager.self.falling = true;
            this.input.canJump = false; // Prevent repeated jumps
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

    // Aligns player with planet surface on landing
    // This creates a smooth transition from space to surface movement
    static landing(upVector, surfacePosition) {
        // Keep only yaw rotation for smooth transition
        const currentYaw = this.groundedAim.y;
        this.groundedAim.set(0, currentYaw, 0);

        // Reset camera first to prevent inheriting unwanted rotations
        Engine.camera.quaternion.set(0, 0, 0, 1);
        
        // Align handle with surface
        const surfaceAlignment = new Quaternion();
        surfaceAlignment.setFromUnitVectors(new Vector3(0, 1, 0), upVector);
        PlayersManager.self.handle.quaternion.copy(surfaceAlignment);

        // Look along surface
        PlayersManager.self.handle.lookAt(
            surfacePosition.clone().add(
                new Vector3(0, 0, 1).applyQuaternion(surfaceAlignment)
            )
        );

        // Re-enable jumping when properly landed
        this.input.canJump = true;
    };

};