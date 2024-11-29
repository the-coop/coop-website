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
        speed: 50,        // Reduced from 100
        sprint: 100,      // Reduced from 200
        jump: 25,
        crouchSpeed: 8,  // Speed of crouch transition
        cameraHeight: {
            normal: 0.85,
            crouch: 0.4   // Height when crouched
        }
    };

    // Consolidate input state
    static inputState = {
        movement: {
            forward: false,
            back: false,
            left: false,
            right: false,
            sprint: false,
            crouch: false  // Add crouch state
        },
        rotation: {
            yaw: 0,
            pitch: 0
        },
        camera: {
            currentHeight: 0.85  // Track current camera height
        }
    };

    // State
    static isPointerLocked = false;

    static async setup(player) {
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

        this.boundResize = this.onResize.bind(this);
        window.addEventListener('resize', this.boundResize);
        this.onResize(); // Ensure correct initial size
    }

    static resetCameraPosition() {
        if (!PlayerManager.protagonist || !PlayerManager.protagonist.cameraPivot) {
            console.error('Cannot reset camera: missing player or cameraPivot');
            return;
        }

        this.inputState.camera.currentHeight = this.movement.cameraHeight.normal;
        PlayerManager.protagonist.cameraPivot.position.set(0, this.movement.cameraHeight.normal, 0);
        
        if (PlayerManager.protagonist.camera) {
            PlayerManager.protagonist.camera.position.set(0, 0, 0);
            PlayerManager.protagonist.camera.rotation.set(0, 0, 0);
        }
        
        this.inputState.rotation.yaw = 0;
        this.inputState.rotation.pitch = 0;
        
        if (PlayerManager.protagonist.firstPersonLeftHand) {
            PlayerManager.protagonist.firstPersonLeftHand.visible = true;
            PlayerManager.protagonist.firstPersonLeftHand.rotation.set(0, Math.PI, 0); // Fix hand orientation
        }
        if (PlayerManager.protagonist.firstPersonRightHand) {
            PlayerManager.protagonist.firstPersonRightHand.visible = true;
            PlayerManager.protagonist.firstPersonRightHand.rotation.set(0, Math.PI, 0); // Fix hand orientation
        }
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

        if (document.pointerLockElement) {
            ControllerManager.exitPointerLock(); // Ensure pointer lock is exited
        }

        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('keydown', this.boundKeyDown);
        document.removeEventListener('keyup', this.boundKeyUp);
        document.removeEventListener('pointerlockchange', this.boundPointerLockChange);
        window.removeEventListener('resize', this.boundResize);
        
        this.reset();

        // Show the player's mesh when FPS is disconnected
        if (PlayerManager.protagonist && PlayerManager.protagonist.mesh) {
            PlayerManager.protagonist.mesh.visible = true;
        }

        // Reset camera rotation upon disconnecting FPS
        this.resetCameraRotation();
    }

    static onResize() {
        if (PlayerManager.protagonist && PlayerManager.protagonist.camera) {
            const canvas = PlayerManager.protagonist.camera.domElement;
            if (canvas) {
                const width = window.innerWidth;
                const height = window.innerHeight;

                canvas.width = width;
                canvas.height = height;

                PlayerManager.protagonist.camera.aspect = width / height;
                PlayerManager.protagonist.camera.updateProjectionMatrix();
            }
        }
    }

    static update(delta) {
        if (!PlayerManager.protagonist) return;
        
        // Update camera height for crouching
        this.updateCameraHeight(delta);
        
        const moveDir = new Vector3();
        
        // Get movement direction from camera orientation
        const cameraQuat = PlayerManager.protagonist.cameraPivot.getWorldQuaternion(new Quaternion());
        const forward = new Vector3(0, 0, -1).applyQuaternion(cameraQuat);
        const right = new Vector3(1, 0, 0).applyQuaternion(cameraQuat);

        // Remove the gamepad polling block
        /*
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let gamepad of gamepads) {
            if (!gamepad) continue;
            
            // Process left stick for movement
            if (Math.abs(gamepad.axes[0]) > 0.1 || Math.abs(gamepad.axes[1]) > 0.1) {
                moveDir.add(right.clone().multiplyScalar(gamepad.axes[0]));
                moveDir.sub(forward.clone().multiplyScalar(gamepad.axes[1])); // Fix movement direction
            }

            // Process right stick for camera
            if (Math.abs(gamepad.axes[2]) > 0.1 || Math.abs(gamepad.axes[3]) > 0.1) {
                this.inputState.rotation.yaw -= gamepad.axes[2] * this.sensitivity.gamepad;
                this.inputState.rotation.pitch -= gamepad.axes[3] * this.sensitivity.gamepad; // Fix inversion
                this.updateRotation();
            }
        }
        */

        // Handle movement from keyboard and gamepad inputs via ControllerManager
        // Add keyboard movement
        if (this.inputState.movement.forward) moveDir.add(forward); // Fix movement direction
        if (this.inputState.movement.back) moveDir.sub(forward); // Fix movement direction
        if (this.inputState.movement.right) moveDir.add(right);
        if (this.inputState.movement.left) moveDir.sub(right);

        // Apply movement if any input
        if (moveDir.length() > 0) {
            moveDir.normalize();
            const speed = this.inputState.movement.sprint ? this.movement.sprint : this.movement.speed;
            PlayerManager.protagonist.vel.add(moveDir.multiplyScalar(speed * delta));
        }
    }

    static updateCameraHeight(delta) {
        if (!PlayerManager.protagonist || !PlayerManager.protagonist.cameraPivot) return;

        const targetHeight = this.inputState.movement.crouch ? 
            this.movement.cameraHeight.crouch : 
            this.movement.cameraHeight.normal;

        const currentHeight = this.inputState.camera.currentHeight;
        
        if (currentHeight !== targetHeight) {
            const direction = targetHeight > currentHeight ? 1 : -1;
            const change = this.movement.crouchSpeed * delta;
            
            const newHeight = Math.abs(targetHeight - currentHeight) <= change ?
                targetHeight :
                currentHeight + (direction * change);

            this.inputState.camera.currentHeight = newHeight;
            PlayerManager.protagonist.cameraPivot.position.y = newHeight;
        }
    }

    // This method should be called after gravity is applied to reset jumping
    static preventDoubleJump() {
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
        if (!this.isPointerLocked) {
            // Triple RAF to ensure Safari UI is fully settled
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        this.onResize();
                        // Force body height update
                        document.body.style.height = '100dvh';
                    });
                });
            });
        }
    }

    static onKeyDown(event) {
        switch (event.code) {
            case 'KeyW': this.inputState.movement.forward = true; break;
            case 'KeyA': this.inputState.movement.left = true; break;
            case 'KeyS': this.inputState.movement.back = true; break;
            case 'KeyD': this.inputState.movement.right = true; break;
            case 'ShiftLeft': this.inputState.movement.sprint = true; break;
            case 'Space': 
                this.jump(); // Use the jump method instead of direct implementation
                break;
            case 'KeyC':
                this.inputState.movement.crouch = true;
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
            case 'KeyC':
                this.inputState.movement.crouch = false;
                break;
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
                // Only process mouse movement when pointer is locked
                if (!this.isPointerLocked) return;
                this.inputState.rotation.yaw -= value.x * this.sensitivity.mouse;
                this.inputState.rotation.pitch -= value.y * this.sensitivity.mouse;
                this.updateRotation();
                break;

            case 'movement':
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

                    case 'leftStick':
                        // Handle analog stick movement
                        if (value.x !== 0) {
                            this.inputState.movement.right = value.x > 0;
                            this.inputState.movement.left = value.x < 0;
                        } else {
                            this.inputState.movement.right = false;
                            this.inputState.movement.left = false;
                        }
                        if (value.y !== 0) {
                            this.inputState.movement.forward = value.y < 0;
                            this.inputState.movement.back = value.y > 0;
                        } else {
                            this.inputState.movement.forward = false;
                            this.inputState.movement.back = false;
                        }
                        break;

                    case 'rightStick':
                        // Process gamepad aim regardless of pointer lock
                        if (value.x !== 0 || value.y !== 0) {
                            this.inputState.rotation.yaw -= value.x * this.sensitivity.gamepad;
                            this.inputState.rotation.pitch -= value.y * this.sensitivity.gamepad;
                            this.updateRotation();
                        }
                        break;
                }
                break;
        }
    }

    static jump() {
        if (!PlayerManager.protagonist) return;
        
        // Only jump if we're not already jumping or falling
        if (!PlayerManager.protagonist.jumping && !PlayerManager.protagonist.falling) {
            const jumpVel = PlayerManager.protagonist.surfaceNormal.clone().multiplyScalar(this.movement.jump);
            PlayerManager.protagonist.vel.add(jumpVel);
            PlayerManager.protagonist.jumping = true;
            console.log('Jump executed with velocity:', jumpVel);
        }
    }

    static updateMobileInput(input, value) {
        // Handle mobile inputs if necessary
    }

}
