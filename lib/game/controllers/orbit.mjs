import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Engine from '../engine.mjs';
import { Vector3, Quaternion } from 'three';

export default class OrbitController {
    static controls = null;

    static setup(camera, domElement) {
        if (!Engine.scene || !camera || !domElement) {
            console.error('OrbitController: Missing required parameters');
            return;
        }
        
        try {
            this.controls = new OrbitControls(camera, domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.screenSpacePanning = false;
            this.controls.minDistance = 10;
            this.controls.maxDistance = 500;
            this.controls.enableZoom = true;
            this.controls.enableRotate = true;
            this.controls.enablePan = false;
        } catch (e) {
            console.error('Failed to initialize OrbitControls:', e);
            this.controls = null;
        }
    }

    static update(delta) {
        if (this.controls) {
            this.controls.update();
        }
    }

    static disconnect() {
        if (this.controls) {
            try {
                this.controls.dispose();
            } catch (e) {
                console.warn('Error disposing OrbitControls:', e);
            }
            this.controls = null;
        }
    }

    static resetCameraPosition() {
        if (this.controls) {
            this.controls.reset();
        }
    }
}
