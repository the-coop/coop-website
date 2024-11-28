import { Vector3, Euler, Quaternion } from 'three';
import AnimationManager from '../animations/animationManager.mjs';

export default class FPS {
    static normalMoveSpeed = 50; // Increased from 20 to 50 for faster ground movement
    static airMoveSpeed = 25;    // Increased from 10 to 25 for faster air movement
    static sprintSpeed = 200;    // Increased from 100 to 200 for much faster sprint
    static lookSpeed = 0.002;    // Reduced for smoother rotation
    static jumpForce = 25;       // Increased jump force significantly
    static player = null;
    static isPointerLocked = false;  // Add this line
    
    // Replace individual movement flags with an input object
    static input = {
        forward: false,
        back: false,
        left: false,
        right: false,
        rocket: false, // Added rocket flag
        sprint: false  // Added sprint flag
    };

    // Define rocket force
    static rocketForce = 50; // Adjust the value as needed for rocket strength

    // Variables to track rotation angles
    static yaw = 0;   // Horizontal rotation
    static pitch = 0; // Vertical rotation

    static setup(player) {
        this.player = player;
        this.boundMouseMove = this.onMouseMove.bind(this);
        this.boundKeyDown = this.onKeyDown.bind(this);
        this.boundKeyUp = this.onKeyUp.bind(this);
        this.boundPointerLockChange = this.onPointerLockChange.bind(this);
        this.boundRequestPointerLock = () => document.body.requestPointerLock();

        document.addEventListener('mousemove', this.boundMouseMove);
        document.addEventListener('keydown', this.boundKeyDown);
        document.addEventListener('keyup', this.boundKeyUp);
        document.addEventListener('click', this.boundRequestPointerLock);
        document.addEventListener('pointerlockchange', this.boundPointerLockChange);
    }

    static disconnect() {
        if (document.pointerLockElement) document.exitPointerLock();
        this.player = null;
        // Reset all input states
        this.input.forward = this.input.back = this.input.left = this.input.right = false;
        this.input.sprint = false; // Reset sprint state

        // Remove event listeners
        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('keydown', this.boundKeyDown);
        document.removeEventListener('keyup', this.boundKeyUp);
        document.removeEventListener('click', this.boundRequestPointerLock);
        document.removeEventListener('pointerlockchange', this.boundPointerLockChange);
    }

    static onPointerLockChange() {
        this.isPointerLocked = document.pointerLockElement !== null;
    }

    static onMouseMove(event) {
        if (!this.isPointerLocked || !this.player) return;
        const player = this.player;

        // Update yaw and pitch based on mouse movement
        this.yaw -= event.movementX * this.lookSpeed;
        this.pitch -= event.movementY * this.lookSpeed;

        // Only constrain pitch when player is grounded
        if (!player.falling && !player.jumping) {
            this.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.pitch));
        }

        // Apply yaw to player pivot
        player.pivot.rotation.y = this.yaw;
        
        // Apply pitch to camera pivot only
        player.cameraPivot.rotation.x = this.pitch;
    }

    static update(delta) {
        const player = this.player;
        if (!player) return;

        const moveDir = new Vector3();
        
        // Use camera's direction for movement
        const cameraQuat = player.cameraPivot.getWorldQuaternion(new Quaternion());
        const forward = new Vector3(0, 0, -1).applyQuaternion(cameraQuat);
        const right = new Vector3(1, 0, 0).applyQuaternion(cameraQuat);

        const isAirborne = player.falling || player.jumping;

        if (!isAirborne) {
            // When grounded, project directions onto the surface plane
            const surfaceNormal = player.surfaceNormal;
            forward.sub(surfaceNormal.clone().multiplyScalar(forward.dot(surfaceNormal))).normalize();
            right.sub(surfaceNormal.clone().multiplyScalar(right.dot(surfaceNormal))).normalize();
        }
        // When airborne, use raw camera directions without surface projection

        // Update moveDir based on input
        if (this.input.forward) moveDir.add(forward);
        if (this.input.back) moveDir.sub(forward);
        if (this.input.right) moveDir.add(right);
        if (this.input.left) moveDir.sub(right);

        // Determine movement speed
        let currentMoveSpeed = isAirborne ? this.airMoveSpeed : this.normalMoveSpeed;

        // Apply sprint speed if sprinting
        if (this.input.sprint && this.input.forward) {
            currentMoveSpeed = this.sprintSpeed;
        }

        // Apply movement
        if (moveDir.length() > 0 || player.falling) {
            moveDir.normalize();
            player.vel.add(moveDir.multiplyScalar(currentMoveSpeed * delta));
        }

        // Apply rocket force when 'E' key is pressed
        if (this.input.rocket) {
            // Use either surface normal or up vector depending on state
            const upVector = isAirborne ? new Vector3(0, 1, 0) : player.surfaceNormal;
            player.vel.add(upVector.multiplyScalar(this.rocketForce * delta));
        }
    }

    static onKeyDown(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW': this.input.forward = true; break;
            case 'ArrowLeft':
            case 'KeyA': this.input.left = true; break;
            case 'ArrowDown':
            case 'KeyS': this.input.back = true; break;
            case 'ArrowRight':
            case 'KeyD': this.input.right = true; break;
            case 'ShiftLeft':
            case 'ShiftRight': this.input.sprint = true; break; // Handle 'Shift' key press
            case 'Space': {
                const player = this.player;
                if (!player.falling && !player.jumping) {
                    // Get current movement direction
                    const cameraQuat = player.cameraPivot.getWorldQuaternion(new Quaternion());
                    const forward = new Vector3(0, 0, -1).applyQuaternion(cameraQuat);
                    const right = new Vector3(1, 0, 0).applyQuaternion(cameraQuat);
                    const moveDir = new Vector3();

                    // Calculate movement direction based on input
                    if (this.input.forward) moveDir.add(forward);
                    if (this.input.back) moveDir.sub(forward);
                    if (this.input.right) moveDir.add(right);
                    if (this.input.left) moveDir.sub(right);

                    // If moving, add horizontal momentum to jump
                    if (moveDir.length() > 0) {
                        moveDir.normalize();
                        const jumpSpeed = this.input.sprint ? this.sprintSpeed : this.normalMoveSpeed;
                        moveDir.multiplyScalar(jumpSpeed * 0.5); // Half of normal speed for jump momentum
                        player.vel.add(moveDir);
                    }

                    // Add vertical jump force
                    player.vel.add(player.surfaceNormal.clone().multiplyScalar(this.jumpForce));
                    player.jumping = true;
                }
                break;
            }
            case 'KeyE':
                this.input.rocket = true; // Handle 'E' key press
                break;
        }
    }

    static onKeyUp(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW': this.input.forward = false; break;
            case 'ArrowLeft':
            case 'KeyA': this.input.left = false; break;
            case 'ArrowDown':
            case 'KeyS': this.input.back = false; break;
            case 'ArrowRight':
            case 'KeyD': this.input.right = false; break;
            case 'ShiftLeft':
            case 'ShiftRight': this.input.sprint = false; break; // Handle 'Shift' key release
            case 'KeyE':
                this.input.rocket = false; // Handle 'E' key release
                break;
        }
    }

    // This method should be called after gravity is applied to reset jumping
    static applyGravityAndCheckLanding() {
        const player = this.player;

        // Reset jumping when the player has landed
        if (player && !player.falling && player.jumping) {
            player.jumping = false; 
        }
    }

    static reset() {
        // Reset movement states
        this.input.forward = false;
        this.input.back = false;
        this.input.left = false;
        this.input.right = false;
        this.input.sprint = false; // Reset sprint state

        // Reset rotation angles
        this.yaw = 0;
        this.pitch = 0;

        // Reset arm swing angles in AnimationManager
        AnimationManager.armSwingAngle = 0;
        AnimationManager.armSwingDirection = 1;

        // Reset player velocity and states
        if (this.player) {
            this.player.vel.set(0, 0, 0);
            this.player.jumping = false;
            this.player.falling = false;
            
            // Optionally reset player position and orientation
            // this.player.object.position.copy(initialPosition);
            // this.player.object.quaternion.set(0, 0, 0, 1);
        }

        // Reset camera rotation
        if (this.player && this.player.camera) {
            this.player.camera.rotation.set(0, 0, 0);
        }
    }
};
