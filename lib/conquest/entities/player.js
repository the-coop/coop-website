import * as THREE from 'three';
import PLANETS_SPECIFICATION from '../generation/planets-specification.json';

export default class Player {
    constructor() {

    }

    onGround = false;

    mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.4, 0.4),
        new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );

    handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xff052, wireframe: true })
    );

    aim = new THREE.Quaternion();
    
    velocity = new THREE.Vector3(0, 0, 0);

    current_planet = PLANETS_SPECIFICATION.children[1];

    isSpawned() {
        console.log('Invalid spawn check');
        return true;
    }
}