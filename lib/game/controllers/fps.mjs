import { Vector3, Quaternion } from 'three';
import PlayerManager from '../players/playerManager.mjs';

export default class FPSController {
    // Consolidate all input sensitivities
    static sensitivity = {
        mouse: 0.0005,
        gamepad: 0.05,
        touch: 0.002
    };
    
    // Consolidate movement settings
    static movement = {
        speed: 50,
        sprint: 200,
        jump: 25
    };

    // Consolidate input state
    static inputState = {
        movement: {
            forward: false,
            back: false,
            left: false,
            right: false,
            sprint: false
        },
        rotation: {
            yaw: 0,
            pitch: 0
        }
    };

    // State
    static isPointerLocked = false;

    static setup(player) {
        if (typeof window === 'undefined') {
            console.error('FPS setup failed: invalid window');
            return;
        }

        // Use protagonist directly
        if (!PlayerManager.protagonist || !PlayerManager.protagonist.mesh || !PlayerManager.protagonist.cameraPivot) {
            console.error('FPS setup failed: missing required player components');
            return;
        }

        // Reset state and ensure clean setup
        this.reset();
        this.isPointerLocked = false;

        this.boundPointerLockChange = this.onPointerLockChange.bind(this);
        document.addEventListener('pointerlockchange', this.boundPointerLockChange);

        if (PlayerManager.protagonist.mesh) {
            PlayerManager.protagonist.mesh.visible = false;
        }
        this.resetCameraPosition();
    }

    static resetCameraPosition() {
        if (!PlayerManager.protagonist || !PlayerManager.protagonist.cameraPivot) {
            console.error('Cannot reset camera: missing player or cameraPivot');
            return;
        }

        // Replace all this.player references with PlayerManager.protagonist
        PlayerManager.protagonist.cameraPivot.position.set(0, 0.85, 0);
        
        if (PlayerManager.protagonist.camera) {
            PlayerManager.protagonist.camera.position.set(0, 0, 0);
            PlayerManager.protagonist.camera.rotation.set(0, 0, 0);
        }
        
        this.inputState.rotation.yaw = 0;
        this.inputState.rotation.pitch = 0;
        
        if (PlayerManager.protagonist.firstPersonLeftHand) 
            PlayerManager.protagonist.firstPersonLeftHand.visible = true;
        if (PlayerManager.protagonist.firstPersonRightHand) 
            PlayerManager.protagonist.firstPersonRightHand.visible = true;
    }

    static resetCameraRotation() {
        if (PlayerManager.protagonist && PlayerManager.protagonist.camera) {
            PlayerManager.protagonist.camera.rotation.set(0, 0, 0);
            this.inputState.rotation.yaw = 0;
            this.inputState.rotation.pitch = 0;
        }
    }

    static disconnect() {
        if (typeof window === 'undefined') return;

        if (document.pointerLockElement) document.exitPointerLock();
        
        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('keydown', this.boundKeyDown);
        document.removeEventListener('keyup', this.boundKeyUp);
        document.removeEventListener('pointerlockchange', this.boundPointerLockChange);
        
        this.reset();

        // Show the player's mesh when FPS is disconnected
        if (PlayerManager.protagonist && PlayerManager.protagonist.mesh) {
            PlayerManager.protagonist.mesh.visible = true;
        }

        // Reset camera rotation upon disconnecting FPS
        this.resetCameraRotation();
    }

    static update(delta) {
        if (!PlayerManager.protagonist) return;
        
        const moveDir = new Vector3();
        
        // Get movement direction from camera orientation
        const cameraQuat = PlayerManager.protagonist.cameraPivot.getWorldQuaternion(new Quaternion());
        const forward = new Vector3(0, 0, -1).applyQuaternion(cameraQuat);
        const right = new Vector3(1, 0, 0).applyQuaternion(cameraQuat);

        // Get gamepad left stick input
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let gamepad of gamepads) {
            if (!gamepad) continue;
            
            // Process left stick for movement
            if (Math.abs(gamepad.axes[0]) > 0.1 || Math.abs(gamepad.axes[1]) > 0.1) {
                moveDir.add(right.clone().multiplyScalar(gamepad.axes[0]));
                moveDir.sub(forward.clone().multiplyScalar(gamepad.axes[1]));
            }

            // Process right stick for camera
            if (Math.abs(gamepad.axes[2]) > 0.1 || Math.abs(gamepad.axes[3]) > 0.1) {
                this.inputState.rotation.yaw -= gamepad.axes[2] * this.sensitivity.gamepad;
                this.inputState.rotation.pitch += gamepad.axes[3] * this.sensitivity.gamepad;
                this.updateRotation();
            }
        }

        // Add keyboard movement
        if (this.inputState.movement.forward) moveDir.sub(forward);
        if (this.inputState.movement.back) moveDir.add(forward);
        if (this.inputState.movement.right) moveDir.add(right);
        if (this.inputState.movement.left) moveDir.sub(right);

        // Apply movement if any input
        if (moveDir.length() > 0) {
            moveDir.normalize();
            const speed = this.inputState.movement.sprint ? this.movement.sprint : this.movement.speed;
            PlayerManager.protagonist.vel.add(moveDir.multiplyScalar(speed * delta));
        }
    }

    // This method should be called after gravity is applied to reset jumping
    static applyGravityAndCheckLanding() {
        const player = PlayerManager.protagonist;
        if (player && !player.falling && player.jumping) {
            player.jumping = false;
        }
    }

    static updateRotation() {
        if (!PlayerManager.protagonist || !PlayerManager.protagonist.cameraPivot) return;
        
        // Constrain pitch to prevent over-rotation
        this.inputState.rotation.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.inputState.rotation.pitch));
        
        // Update player/camera rotation
        if (PlayerManager.protagonist.pivot) {
            PlayerManager.protagonist.pivot.rotation.y = this.inputState.rotation.yaw;
        }
        PlayerManager.protagonist.cameraPivot.rotation.x = this.inputState.rotation.pitch;
    }

    static onPointerLockChange() {
        this.isPointerLocked = document.pointerLockElement !== null;
    }

    static onKeyDown(event) {
        switch (event.code) {
            case 'KeyW': this.inputState.movement.forward = true; break;
            case 'KeyA': this.inputState.movement.left = true; break;
            case 'KeyS': this.inputState.movement.back = true; break;
            case 'KeyD': this.inputState.movement.right = true; break;
            case 'ShiftLeft': this.inputState.movement.sprint = true; break;
            case 'Space':
                if (PlayerManager.protagonist && !PlayerManager.protagonist.jumping && !PlayerManager.protagonist.falling) {
                    PlayerManager.protagonist.vel.add(PlayerManager.protagonist.surfaceNormal.clone().multiplyScalar(this.movement.jump));
                    PlayerManager.protagonist.jumping = true;
                }
                break;
        }
    }

    static onKeyUp(event) {
        switch (event.code) {
            case 'KeyW': this.inputState.movement.forward = false; break;
            case 'KeyA': this.inputState.movement.left = false; break;
            case 'KeyS': this.inputState.movement.back = false; break;
            case 'KeyD': this.inputState.movement.right = false; break;
            case 'ShiftLeft': this.inputState.movement.sprint = false; break;
        }
    }

    static reset() { // Modify reset method to clear any domElement related listeners if added in future
        this.isPointerLocked = false;
        this.inputState.rotation.yaw = 0;
        this.inputState.rotation.pitch = 0;
        Object.keys(this.inputState.movement).forEach(key => this.inputState.movement[key] = false);
    }

    // Consolidate update methods
    static updateInput(type, input, value) {
        if (!PlayerManager.protagonist) return;

        switch(type) {
            case 'mouseMovement':
                // Handle mouse movement directly
                this.inputState.rotation.yaw -= value.x * this.sensitivity.mouse;
                this.inputState.rotation.pitch -= value.y * this.sensitivity.mouse;
                this.updateRotation();
                break;

            case 'movement':
                // Handle movement and actions
                switch(input) {
                    case 'forward':
                    case 'back':
                    case 'left':
                    case 'right':
                    case 'sprint':
                        this.inputState.movement[input] = value;
                        break;
                    case 'jump':
                        if (value) this.jump();
                        break;
                }
                break;
        }
    }

    static jump() {
        if (PlayerManager.protagonist && !PlayerManager.protagonist.jumping && !PlayerManager.protagonist.falling) {
            PlayerManager.protagonist.vel.add(
                PlayerManager.protagonist.surfaceNormal.clone().multiplyScalar(this.movement.jump)
            );
            PlayerManager.protagonist.jumping = true;
        }
    }

    static updateMobileInput(input, value) {
        // Handle mobile inputs if necessary
    }

}
