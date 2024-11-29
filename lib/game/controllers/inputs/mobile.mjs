import ControllerManager from '../controllerManager.mjs';

export default class MobileInput {
    // TODO: Refactor to static when doing mobile controls
    constructor() {
        this.joystick = null;
        this.touchHandlers = {
            jump: this.handleJump.bind(this),
            jumpEnd: this.handleJumpEnd.bind(this),
            sprint: this.handleSprint.bind(this),
            sprintEnd: this.handleSprintEnd.bind(this)
        };
    }

    init() {
        window.addEventListener('touchstart', this.touchHandlers.jump, { passive: false });
        window.addEventListener('touchend', this.touchHandlers.jumpEnd, { passive: false });
        window.addEventListener('touchstart', this.touchHandlers.sprint, { passive: false });
        window.addEventListener('touchend', this.touchHandlers.sprintEnd, { passive: false });
        // Initialize joystick if needed
    }

    cleanup() {
        window.removeEventListener('touchstart', this.touchHandlers.jump);
        window.removeEventListener('touchend', this.touchHandlers.jumpEnd);
        window.removeEventListener('touchstart', this.touchHandlers.sprint);
        window.removeEventListener('touchend', this.touchHandlers.sprintEnd);
        // Cleanup joystick if needed
    }

    handleJump(event) {
        ControllerManager.setInput('mobile', 'jump', true);
    }

    handleJumpEnd(event) {
        ControllerManager.setInput('mobile', 'jump', false);
    }

    handleSprint(event) {
        ControllerManager.setInput('mobile', 'sprint', true);
    }

    handleSprintEnd(event) {
        ControllerManager.setInput('mobile', 'sprint', false);
    }

    // Additional methods for joystick can be added here

    update(delta) {
        // Implement any per-frame updates for mobile inputs here
    }
}