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
        jump: false
    };

    // Track player's view angles for ground movement
    static eulerAngles = new Euler(0, 0, 0, 'YXZ');  // YXZ order matches natural view rotation

    // Camera may need detaching or transitions to other controllers.
    static reset() {
        // Initial camera attachment
        Engine.camera.position.set(0, 0.5, 0);
        Engine.camera.quaternion.set(0, 0, 0, 1);
        PlayersManager.self.mesh.add(Engine.camera);  // [1] Initial attachment to mesh
    };

    static falling(upVector) {
        // Handle rotates in space, camera follows because it's attached to mesh
        const rotX = new Quaternion().setFromAxisAngle(
            new Vector3(0, 1, 0),
            this.input.rotation.x
        );
        const rotY = new Quaternion().setFromAxisAngle(
            new Vector3(1, 0, 0),
            this.input.rotation.y
        );

        PlayersManager.self.handle.quaternion.multiply(rotX).multiply(rotY);
        PlayersManager.self.aim.copy(PlayersManager.self.handle.quaternion);
        // [2] No camera quaternion update needed - follows mesh automatically

        // Apply movement input for air control
        if (this.input.movement.lengthSq() > 0) {
            const airControlSpeed = 0.1;
            const movement = this.input.movement.normalize().multiplyScalar(airControlSpeed);

            // Convert movement to world space relative to current aim
            const worldMovement = movement.applyQuaternion(PlayersManager.self.aim);
            PlayersManager.self.velocity.add(worldMovement);
        }
    }

    static grounded(upVector) {
        // [3] Camera quaternion is updated directly in grounded state

        //TODO:
        //only need  this.eulerAngles.x , could probally be a float instead of a vector
        //move the controls away from here

        // Update euler angles from input
        this.eulerAngles.y += this.input.rotation.x;  // Yaw (left/right)
        this.eulerAngles.x = Math.max(               // Pitch (up/down)
            -Math.PI * 0.4,  // Can look down more (-72 degrees)
            Math.min(Math.PI * 0.45, this.eulerAngles.x + this.input.rotation.y)  // Can look up more (+81 degrees)
        );

        //this caculates a new vector space using the old forward facing vector and the new up, 
        //then uses that to caculate a new point to look.using the old forward stops it drifing to the side when near the poles.

        const normal = PlayersManager.self.surfaceNormal;  //this should be the surface normal
        const forward = new Vector3(0, 0, 1).applyQuaternion(PlayersManager.self.handle.quaternion); //direction the player is already facing
        const side = new Vector3().crossVectors(normal, forward); // caculate the side vector
        side.normalize();

        const _targetPosition = new Vector3();
        const Angle = this.input.rotation.x;
        _targetPosition.addScaledVector(forward, Math.cos(Angle)).addScaledVector(side, Math.sin(Angle)); // get point to look at
        _targetPosition.projectOnPlane(normal); // remove all the vertical compnent so the body stays facing around not up
        _targetPosition.normalize();

        //get handle position
        const position = new Vector3();
        PlayersManager.self.handle.getWorldPosition(position);

        //make the target global instead of local
        _targetPosition.add(position);
        // Apply yaw to handle (which also rotates mesh and camera since they're children)
        PlayersManager.self.handle.up.copy(normal);
        PlayersManager.self.handle.lookAt(_targetPosition);

        //now set the angle of the camera
        Engine.camera.quaternion.setFromEuler(new Euler(this.eulerAngles.x, 0, 0));

        // Apply movement input relative to view direction
        if (this.input.movement.lengthSq() > 0) {
            const moveSpeed = 0.5;
            const movement = this.input.movement.normalize().multiplyScalar(moveSpeed);

            // Convert movement to world space relative to handle orientation
            const worldMovement = movement.applyQuaternion(PlayersManager.self.handle.quaternion);
            PlayersManager.self.velocity.add(worldMovement);
        }

        // Apply jump if requested
        if (this.input.jump) {
            PlayersManager.self.velocity.add(normal.multiplyScalar(10));
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
    // seperate forward from the controls
    //maybe move gravity here. get all the forces in 1 place
    // this would allow better vechile control

    // Aligns player with planet surface on landing
    // This creates a smooth transition from space to surface movement
    static landing(upVector) {

        //find where the camera is pointing
        const forward = new Vector3(0, 0, -1).applyQuaternion(PlayersManager.self.handle.quaternion);

        //check how much its up or down, and convert it to an angle
        const Upfacing = forward.dot(upVector);
        const currentYaw = Math.asin(Upfacing);

        //set the camera angle
        this.eulerAngles.set(currentYaw, 0, 0);
    };

    // Aligns player with planet surface on liftoff
    // This creates a smooth transition from surface movement to space
    static liftoff() {

        //get old rotation of camera
        const quaternion = new Quaternion();
        Engine.camera.getWorldQuaternion(quaternion);

        //clear camera rotation
        this.eulerAngles.set(0, 0, 0);

        //set handle to camera rotation
        Engine.camera.quaternion.setFromEuler(new Euler(0, 0, 0));
        PlayersManager.self.handle.setRotationFromQuaternion(quaternion);

    };


};