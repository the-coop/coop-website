import PlayerManager from '../players/playerManager.mjs';

export default class AnimationManager {
    
    // Arm swing parameters
    static armSwingAngle = 0;
    static armSwingDirection = 1;
    static walkSwingSpeed = 2;
    static runSwingSpeed = 4;
    static walkMaxSwing = Math.PI / 6;  // 30 degrees
    static runMaxSwing = Math.PI / 4;   // 45 degrees

    // Head bob parameters
    static bobHeight = 0;
    static bobDirection = 1;
    static walkBobSpeed = 3;
    static runBobSpeed = 6;
    static walkBobAmount = 0.02;
    static runBobAmount = 0.04;

    // Leg animation parameters
    static legSwingAngle = 0;
    static legSwingDirection = 1;

    // Falling animation parameters
    static flailTimer = 0;
    static flailSpeed = 15;  // Speed of arm flailing
    static flailAmount = Math.PI / 2;  // Maximum flail rotation (90 degrees)

    static updateAnimations(delta) {
        const protagonist = PlayerManager.getProtagonist(); // Change getPlayer to getProtagonist
        if (!protagonist) return;

        // Create a temporary input object if it doesn't exist
        const input = protagonist.input || {
            forward: false,
            back: false,
            left: false,
            right: false,
            sprint: false
        };

        if (protagonist.falling) {
            // Update flail timer
            this.flailTimer += delta * this.flailSpeed;

            // Generate random arm rotations based on time
            if (protagonist.leftArm && protagonist.rightArm) {
                // Use sine waves with different frequencies for chaotic motion
                const leftArmX = Math.sin(this.flailTimer) * this.flailAmount;
                const leftArmZ = Math.cos(this.flailTimer * 1.3) * this.flailAmount;
                const rightArmX = Math.sin(this.flailTimer * 1.2) * this.flailAmount;
                const rightArmZ = Math.cos(this.flailTimer * 0.9) * this.flailAmount;

                // Apply rotations
                protagonist.leftArm.rotation.x = leftArmX;
                protagonist.leftArm.rotation.z = leftArmZ;
                protagonist.rightArm.rotation.x = rightArmX;
                protagonist.rightArm.rotation.z = rightArmZ;

                // Also rotate legs slightly
                if (protagonist.leftLeg && protagonist.rightLeg) {
                    protagonist.leftLeg.rotation.x = Math.sin(this.flailTimer * 0.8) * this.flailAmount * 0.3;
                    protagonist.rightLeg.rotation.x = Math.cos(this.flailTimer * 0.8) * this.flailAmount * 0.3;
                }
            }
            return; // Skip normal animations while falling
        }

        const isMoving = input.forward || input.back || input.left || input.right;
        const isRunning = input.sprint && input.forward;

        if (isMoving) {
            // Set animation speeds and ranges based on movement type
            const swingSpeed = isRunning ? this.runSwingSpeed : this.walkSwingSpeed;
            const maxSwing = isRunning ? this.runMaxSwing : this.walkMaxSwing;
            const bobSpeed = isRunning ? this.runBobSpeed : this.walkBobSpeed;
            const bobAmount = isRunning ? this.runBobAmount : this.walkBobAmount;

            // Update arm swing
            this.armSwingAngle += this.armSwingDirection * swingSpeed * delta;
            if (Math.abs(this.armSwingAngle) > maxSwing) {
                this.armSwingDirection *= -1;
                // Sync leg swing with arm swing
                this.legSwingDirection *= -1;
            }

            // Update head bob
            this.bobHeight += this.bobDirection * bobSpeed * delta;
            if (Math.abs(this.bobHeight) > bobAmount) {
                this.bobDirection *= -1;
            }

            // Apply animations
            if (protagonist.leftArm && protagonist.rightArm) {
                // Arm animations
                protagonist.leftArm.rotation.x = this.armSwingAngle;
                protagonist.rightArm.rotation.x = -this.armSwingAngle;
                protagonist.leftArm.rotation.z = Math.abs(this.armSwingAngle) * 0.2;
                protagonist.rightArm.rotation.z = -Math.abs(this.armSwingAngle) * 0.2;
            }

            // Leg animations
            if (protagonist.leftLeg && protagonist.rightLeg) {
                protagonist.leftLeg.rotation.x = -this.armSwingAngle;  // Opposite to arms
                protagonist.rightLeg.rotation.x = this.armSwingAngle;
            }

            // Head bob
            if (protagonist.cameraPivot) {
                const currentY = 0.85 + this.bobHeight;  // Base height + bob
                protagonist.cameraPivot.position.y = currentY;
            }
        } else {
            // Reset animations when not moving
            this.smoothResetAnimations(protagonist);
        }
    }

    static smoothResetAnimations(protagonist) {
        // Smoothly reset all animations to neutral position
        const resetFactor = 0.9;

        if (protagonist.leftArm && protagonist.rightArm) {
            protagonist.leftArm.rotation.x *= resetFactor;
            protagonist.rightArm.rotation.x *= resetFactor;
            protagonist.leftArm.rotation.z *= resetFactor;
            protagonist.rightArm.rotation.z *= resetFactor;
        }

        if (protagonist.leftLeg && protagonist.rightLeg) {
            protagonist.leftLeg.rotation.x *= resetFactor;
            protagonist.rightLeg.rotation.x *= resetFactor;
        }

        if (protagonist.cameraPivot) {
            const currentY = protagonist.cameraPivot.position.y;
            protagonist.cameraPivot.position.y = 0.85 + (currentY - 0.85) * resetFactor;
        }

        this.armSwingAngle *= resetFactor;
        this.bobHeight *= resetFactor;
    }

    static reset() {
        this.armSwingAngle = 0;
        this.armSwingDirection = 1;
        this.bobHeight = 0;
        this.bobDirection = 1;
        this.legSwingAngle = 0;
        this.legSwingDirection = 1;
        this.flailTimer = 0;
    }
}
