import { Vector3, Quaternion } from 'three';
import PlayerManager from '../players/playerManager.mjs';
import State from '../state.mjs';
import ControllerManager from './controllerManager.mjs';

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

    static async setup() {
        // Wait for game started state
        if (!State.isGameStarted) {
            console.log('FPS setup deferred: game not started');
            return;
        }

        // Ensure we have a window context
        if (typeof window === 'undefined') {
            console.error('FPS setup failed: invalid window');
            return;
        }

        // Ensure protagonist exists before continuing
        const protagonist = await PlayerManager.getProtagonist();
        if (!protagonist || !protagonist.mesh || !protagonist.cameraPivot) {
            console.error('FPS setup failed: missing required player components');
            return;
        }

        // Reset state and ensure clean setup
        this.reset();
        
        // Initialize bound handlers with proper method implementations
        this.boundHandlers = {
            mousemove: (event) => this.onMouseMove(event),
            keydown: (event) => this.onKeyDown(event),
            keyup: (event) => this.onKeyUp(event),
            pointerlockchange: (event) => this.onPointerLockChange(event),
            resize: (event) => this.onResize(event)
        };

        // Add event listeners
        document.addEventListener('mousemove', this.boundHandlers.mousemove);
        document.addEventListener('keydown', this.boundHandlers.keydown);
        document.addEventListener('keyup', this.boundHandlers.keyup);
        document.addEventListener('pointerlockchange', this.boundHandlers.pointerlockchange);
        window.addEventListener('resize', this.boundHandlers.resize);

        // Hide player mesh and setup camera
        if (protagonist.mesh) {
            protagonist.mesh.visible = false;
        }
        
        this.resetCameraPosition();
        return true;
    }

    static resetCameraPosition() {
        const protagonist = PlayerManager.getProtagonist();
        if (!protagonist || !protagonist.cameraPivot) {
            console.error('Cannot reset camera: missing player or cameraPivot');
            return;
        }

        this.inputState.camera.currentHeight = this.movement.cameraHeight.normal;
        protagonist.cameraPivot.position.set(0, this.movement.cameraHeight.normal, 0);
        
        if (protagonist.camera) {
            protagonist.camera.position.set(0, 0, 0);
            protagonist.camera.rotation.set(0, 0, 0);
        }
        
        this.inputState.rotation.yaw = 0;
        this.inputState.rotation.pitch = 0;
        
        if (protagonist.firstPersonLeftHand) {
            protagonist.firstPersonLeftHand.visible = true;
            protagonist.firstPersonLeftHand.rotation.set(0, Math.PI, 0); // Fix hand orientation
        }
        if (protagonist.firstPersonRightHand) {
            protagonist.firstPersonRightHand.visible = true;
            protagonist.firstPersonRightHand.rotation.set(0, Math.PI, 0); // Fix hand orientation
        }
    }

    static resetCameraRotation() {
        const protagonist = PlayerManager.getProtagonist();
        if (protagonist && protagonist.camera) {
            protagonist.camera.rotation.set(0, 0, 0);
            this.inputState.rotation.yaw = 0;
            this.inputState.rotation.pitch = 0;
        }
    }

    static disconnect() {
        if (typeof window === 'undefined') return;

        if (document.pointerLockElement) {
            ControllerManager.exitPointerLock(); // Ensure pointer lock is exited
        }

        // Remove event listeners using stored bound handlers
        if (this.boundHandlers) {
            document.removeEventListener('mousemove', this.boundHandlers.mousemove);
            document.removeEventListener('keydown', this.boundHandlers.keydown);
            document.removeEventListener('keyup', this.boundHandlers.keyup);
            document.removeEventListener('pointerlockchange', this.boundHandlers.pointerlockchange);
            window.removeEventListener('resize', this.boundHandlers.resize);
        }

        // Clear bound handlers
        this.boundHandlers = null;
        
        // Reset state
        this.reset();

        // Show the player's mesh when FPS is disconnected
        const protagonist = PlayerManager.getProtagonist();
        if (protagonist && protagonist.mesh) {
            protagonist.mesh.visible = true;
        }

        // Reset camera rotation upon disconnecting FPS
        this.resetCameraRotation();
    }

    static onResize() {
        const protagonist = PlayerManager.getProtagonist();
        if (protagonist && protagonist.camera) {
            const canvas = protagonist.camera.domElement;
            if (canvas) {
                const width = window.innerWidth;
                const height = window.innerHeight;

                canvas.width = width;
                canvas.height = height;

                protagonist.camera.aspect = width / height;
                protagonist.camera.updateProjectionMatrix();
            }
        }
    }

    static update(delta) {
        const protagonist = State.protagonist; // Use getter
        if (protagonist) {
            // Update protagonist based on FPS controls
        }
        if (!PlayerManager.getProtagonist()) return;
        
        // Update camera height for crouching
        this.updateCameraHeight(delta);
        
        const moveDir = new Vector3();
        
        // Get movement direction from camera orientation
        const cameraQuat = PlayerManager.getProtagonist().cameraPivot.getWorldQuaternion(new Quaternion());
        const forward = new Vector3(0, 0, -1).applyQuaternion(cameraQuat);
        const right = new Vector3(1, 0, 0).applyQuaternion(cameraQuat);

        // Handle movement from keyboard and gamepad inputs via ControllerManager
        if (this.inputState.movement.forward) moveDir.add(forward); // Fix movement direction
        if (this.inputState.movement.back) moveDir.sub(forward); // Fix movement direction
        if (this.inputState.movement.right) moveDir.add(right);
        if (this.inputState.movement.left) moveDir.sub(right);

        // Apply movement if any input
        if (moveDir.length() > 0) {
            moveDir.normalize();
            const speed = this.inputState.movement.sprint ? this.movement.sprint : this.movement.speed;
            PlayerManager.getProtagonist().vel.add(moveDir.multiplyScalar(speed * delta));
        }
    }

    static updateCameraHeight(delta) {
        const protagonist = PlayerManager.getProtagonist();
        if (!protagonist || !protagonist.cameraPivot) return;

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
            protagonist.cameraPivot.position.y = newHeight;
        }
    }

    // This method should be called after gravity is applied to reset jumping
    static preventDoubleJump() {
        const player = PlayerManager.getProtagonist();
        if (player && !player.falling && player.jumping) {
            player.jumping = false;
        }
    }

    static updateRotation() {
        const protagonist = PlayerManager.getProtagonist();
        if (!protagonist || !protagonist.cameraPivot) return;
        
        // Constrain pitch to prevent over-rotation
        this.inputState.rotation.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.inputState.rotation.pitch));
        
        // Update player/camera rotation
        if (protagonist.pivot) {
            protagonist.pivot.rotation.y = this.inputState.rotation.yaw;
        }
        protagonist.cameraPivot.rotation.x = this.inputState.rotation.pitch;
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
        this.handleKeyDown(event);
    }

    static onKeyUp(event) {
        this.handleKeyUp(event);
    }

    static handleKeyDown(event) {
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

    static handleKeyUp(event) {
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
        const protagonist = PlayerManager.getProtagonist();
        if (!protagonist) return;

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
        const protagonist = PlayerManager.getProtagonist();
        if (!protagonist) return;
        
        // Only jump if we're not already jumping or falling
        if (!protagonist.jumping && !protagonist.falling) {
            const jumpVel = protagonist.surfaceNormal.clone().multiplyScalar(this.movement.jump);
            protagonist.vel.add(jumpVel);
            protagonist.jumping = true;
            console.log('Jump executed with velocity:', jumpVel);
        }
    }

    static updateMobileInput(input, value) {
        // Handle mobile inputs if necessary

    }

    static cleanup() {
        // Existing cleanup logic
    }

    // Add mouse movement handler
    static handleMouseMove(event) {
        if (!this.isPointerLocked) return;
        
        this.updateInput('mouseMovement', null, {
            x: event.movementX || event.mozMovementX || event.webkitMovementX || 0,
            y: event.movementY || event.mozMovementY || event.webkitMovementY || 0
        });
    }

    // Add handler methods that the bound handlers will call
    static onMouseMove(event) {
        this.handleMouseMove(event);
    }

    static handleResize(event) {
        this.onResize();
    }
}
