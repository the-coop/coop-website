import { Vector3, Euler, Quaternion } from 'three';

export default class FPS {
    static moveSpeed = 20; // Increased from 10 to 20
    static lookSpeed = 0.002; // Reduced for smoother rotation
    static jumpForce = 25; // Increased jump force significantly
    static player = null;
    static isPointerLocked = false;  // Add this line
    
    // Replace individual movement flags with an input object
    static input = {
        forward: false,
        back: false,
        left: false,
        right: false
    };

    // Variables to track rotation angles
    static yaw = 0;   // Horizontal rotation
    static pitch = 0; // Vertical rotation

    static armSwingAngle = 0;          // Add this line
    static armSwingDirection = 1;      // 1 for forward, -1 for backward

    static setup(player) {
        this.player = player;
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
        document.addEventListener('click', () => document.body.requestPointerLock());
        
        // Add pointer lock change listener
        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement !== null;
        });
    }

    static disconnect() {
        if (document.pointerLockElement) document.exitPointerLock();
        this.player = null;
        // Reset all input states
        this.input.forward = this.input.back = this.input.left = this.input.right = false;
    }

    static onMouseMove(event) {
        if (!this.isPointerLocked || !this.player) return;
        const player = this.player;

        // Update yaw and pitch based on mouse movement
        this.yaw -= event.movementX * this.lookSpeed;
        this.pitch -= event.movementY * this.lookSpeed;
        this.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.pitch));

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

        // Project directions onto the surface plane
        const surfaceNormal = player.surfaceNormal;
        forward.sub(surfaceNormal.clone().multiplyScalar(forward.dot(surfaceNormal))).normalize();
        right.sub(surfaceNormal.clone().multiplyScalar(right.dot(surfaceNormal))).normalize();

        // Update moveDir based on input object
        if (this.input.forward) moveDir.add(forward);
        if (this.input.back) moveDir.sub(forward);
        if (this.input.right) moveDir.add(right);
        if (this.input.left) moveDir.sub(right);

        // Modify condition to include falling state
        if (moveDir.length() > 0 || player.falling) {
            moveDir.normalize();
            // Update velocity using surface-aligned movement direction
            player.vel.add(moveDir.multiplyScalar(this.moveSpeed * delta));

            // Animate arms when moving or falling
            const swingSpeed = 5;                // Adjust for faster/slower swing
            const maxSwing = Math.PI / 6;        // Maximum swing angle (30 degrees)

            this.armSwingAngle += this.armSwingDirection * swingSpeed * delta;
            if (this.armSwingAngle > maxSwing || this.armSwingAngle < -maxSwing) {
                this.armSwingDirection *= -1;     // Reverse direction
            }

            // Apply rotation to arms
            player.leftArm.rotation.x = this.armSwingAngle;
            player.rightArm.rotation.x = -this.armSwingAngle;
        } else {
            // Smoothly reset arms to default position when not moving or falling
            player.leftArm.rotation.x *= 0.9;
            player.rightArm.rotation.x *= 0.9;
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
            case 'Space': {
                const player = this.player;
                if (!player.falling && !player.jumping) {
                    player.vel.add(
                        player.surfaceNormal.clone().multiplyScalar(this.jumpForce)
                    );
                    player.jumping = true;  // Set 'jumping' to true when jumping
                }
                break;
            }
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
        }
    }

    static applyGravityAndCheckLanding() {
        // This method should be called after gravity is applied to reset jumping
        const player = this.player;
        if (player && !player.falling && player.jumping) {
            player.jumping = false; // Reset jumping when the player has landed
        }
    }

    static reset() {
        // Reset movement states
        this.input.forward = false;
        this.input.back = false;
        this.input.left = false;
        this.input.right = false;

        // Reset rotation angles
        this.yaw = 0;
        this.pitch = 0;

        // Reset arm swing
        this.armSwingAngle = 0;
        this.armSwingDirection = 1;

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
