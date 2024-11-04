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
        const player = PlayerManager.getPlayer();
        if (!player || !player.input) return;

        if (player.falling) {
            // Update flail timer
            this.flailTimer += delta * this.flailSpeed;

            // Generate random arm rotations based on time
            if (player.leftArm && player.rightArm) {
                // Use sine waves with different frequencies for chaotic motion
                const leftArmX = Math.sin(this.flailTimer) * this.flailAmount;
                const leftArmZ = Math.cos(this.flailTimer * 1.3) * this.flailAmount;
                const rightArmX = Math.sin(this.flailTimer * 1.2) * this.flailAmount;
                const rightArmZ = Math.cos(this.flailTimer * 0.9) * this.flailAmount;

                // Apply rotations
                player.leftArm.rotation.x = leftArmX;
                player.leftArm.rotation.z = leftArmZ;
                player.rightArm.rotation.x = rightArmX;
                player.rightArm.rotation.z = rightArmZ;

                // Also rotate legs slightly
                if (player.leftLeg && player.rightLeg) {
                    player.leftLeg.rotation.x = Math.sin(this.flailTimer * 0.8) * this.flailAmount * 0.3;
                    player.rightLeg.rotation.x = Math.cos(this.flailTimer * 0.8) * this.flailAmount * 0.3;
                }
            }
            return; // Skip normal animations while falling
        }

        const isMoving = player.input.forward || player.input.back || player.input.left || player.input.right;
        const isRunning = player.input.sprint && player.input.forward;

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
            if (player.leftArm && player.rightArm) {
                // Arm animations
                player.leftArm.rotation.x = this.armSwingAngle;
                player.rightArm.rotation.x = -this.armSwingAngle;
                player.leftArm.rotation.z = Math.abs(this.armSwingAngle) * 0.2;
                player.rightArm.rotation.z = -Math.abs(this.armSwingAngle) * 0.2;
            }

            // Leg animations
            if (player.leftLeg && player.rightLeg) {
                player.leftLeg.rotation.x = -this.armSwingAngle;  // Opposite to arms
                player.rightLeg.rotation.x = this.armSwingAngle;
            }

            // Head bob
            if (player.cameraPivot) {
                const currentY = 0.85 + this.bobHeight;  // Base height + bob
                player.cameraPivot.position.y = currentY;
            }
        } else {
            // Reset animations when not moving
            this.smoothResetAnimations(player);
        }
    }

    static smoothResetAnimations(player) {
        // Smoothly reset all animations to neutral position
        const resetFactor = 0.9;

        if (player.leftArm && player.rightArm) {
            player.leftArm.rotation.x *= resetFactor;
            player.rightArm.rotation.x *= resetFactor;
            player.leftArm.rotation.z *= resetFactor;
            player.rightArm.rotation.z *= resetFactor;
        }

        if (player.leftLeg && player.rightLeg) {
            player.leftLeg.rotation.x *= resetFactor;
            player.rightLeg.rotation.x *= resetFactor;
        }

        if (player.cameraPivot) {
            const currentY = player.cameraPivot.position.y;
            player.cameraPivot.position.y = 0.85 + (currentY - 0.85) * resetFactor;
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
