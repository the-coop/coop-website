import { Vector3, Quaternion } from 'three';

export default class OrbitController {
    static target = null; // The point to orbit around (planet center)
    static distance = 500; // Initial distance from the target
    static azimuth = 0;    // Horizontal angle
    static polar = Math.PI / 2; // Vertical angle

    static isActive = false;

    static rotateSpeed = 0.005;
    static zoomSpeed = 50;

    static camera = null;

    static setup(camera, target) {
        this.camera = camera;
        this.target = target.clone();
        this.isActive = true;

        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('wheel', this.onWheel.bind(this));
        document.addEventListener('keydown', this.onKeyDown.bind(this));
    }

    static disconnect() {
        this.isActive = false;
        document.removeEventListener('mousemove', this.onMouseMove.bind(this));
        document.removeEventListener('wheel', this.onWheel.bind(this));
        document.removeEventListener('keydown', this.onKeyDown.bind(this));
    }

    static reset() {
        this.distance = 500;
        this.azimuth = 0;
        this.polar = Math.PI / 2;
        this.updateCameraPosition();
    }

    static onMouseMove(event) {
        if (!this.isActive) return;
        if (event.buttons === 1) { // Left mouse button
            this.azimuth -= event.movementX * this.rotateSpeed;
            this.polar -= event.movementY * this.rotateSpeed;
            this.polar = Math.max(0.1, Math.min(Math.PI - 0.1, this.polar)); // Prevent flipping
            this.updateCameraPosition();
        }
    }

    static onWheel(event) {
        if (!this.isActive) return;
        this.distance += event.deltaY * this.zoomSpeed * 0.001;
        this.distance = Math.max(100, Math.min(1000, this.distance)); // Clamp distance
        this.updateCameraPosition();
    }

    static onKeyDown(event) {
        if (!this.isActive) return;
        switch (event.code) {
            case 'KeyR':
                this.reset();
                break;
            default:
                break;
        }
    }

    static update(delta) {
        // Orbit controller does not require per-frame updates beyond input handling
    }

    static updateCameraPosition() {
        const x = this.distance * Math.sin(this.polar) * Math.sin(this.azimuth);
        const y = this.distance * Math.cos(this.polar);
        const z = this.distance * Math.sin(this.polar) * Math.cos(this.azimuth);

        this.camera.position.set(this.target.x + x, this.target.y + y, this.target.z + z);
        this.camera.lookAt(this.target);
    }
};
