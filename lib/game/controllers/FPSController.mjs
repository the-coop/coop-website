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
    }

    static grounded() {
      //   Update euler angles from input
        this.eulerAngles.y += this.input.rotation.x;  // Yaw (left/right)
        //this.eulerAngles.x += -this.input.rotation.y; 
        this.eulerAngles.x = Math.max(               // Pitch (up/down)
            0.1,
            Math.min(Math.PI * 0.8, this.eulerAngles.x - this.input.rotation.y)
        );


        let up = new Vector3(0, 1, 0);; // deafult up
        let normal = new Vector3(0, 1, 0) //this should be the surface normal
        const quaternion = new Quaternion();

        // make a transfomration from up to normal
        quaternion.setFromUnitVectors(up, normal); 
        const matrix = new Matrix4(); 
        matrix.makeRotationFromQuaternion(quaternion);

        //get pos
        const _targetPosition = new Vector3();

        var position = new Vector3(); 
        Engine.camera.getWorldPosition(position);

        //get a vector in the direction we should look
        _targetPosition.setFromSphericalCoords(1, this.eulerAngles.x, this.eulerAngles.y);

        //rotate it to new sufrace up
        _targetPosition.applyMatrix4(matrix);

        //make it global instead of local
       const CameraTarget =_targetPosition.clone();
        _targetPosition.add(position);

        Engine.camera.up.copy(normal);
        Engine.camera.lookAt(_targetPosition);


       // //do the the handel
        // flatten the target vector to the horision
        PlayersManager.self.handle.getWorldPosition(position);
        CameraTarget.projectOnPlane(normal) 
        CameraTarget.add(position);

        // Apply yaw to handle (which also rotates mesh and camera since they're children)
        PlayersManager.self.handle.lookAt(CameraTarget);


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

        // Reset pitch but keep current yaw for smooth transition
        const currentYaw = this.eulerAngles.y;
        this.eulerAngles.set(0, currentYaw, 0);
        
    };

};