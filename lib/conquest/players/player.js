import * as THREE from 'three';
import { PLAYER_SIZE } from '../config';
import UNIVERSE_SPECIFICATION from '../universe-specification.json';

export default class Player {
    
    constructor(id, config) {
        const {
            color, connected_at, last_activity, 
            player_id, socket_id, username
        } = config;
        
        this.id = id;
        this.config = {
            color, connected_at, last_activity, 
            player_id, socket_id, username
        };
    }

    config = null;
    id = null;
    
    lat = 0; // used for camera
    lon = 0;

    onGround = false;

    // Network corrections
    correctionVelocity = null;
    correctionTime = null;

    soiIndex = 1;

    soi = UNIVERSE_SPECIFICATION[0].children[1];

    // A reference to the source of this object's orbit influence.
    previous_soi = null;

    mesh = new THREE.Mesh(
        new THREE.BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE),
        new THREE.MeshBasicMaterial({ color: 0xe06666 })
    );

    handle = new THREE.Mesh(
        new THREE.BoxGeometry(PLAYER_SIZE * 1.25, PLAYER_SIZE * 1.25, PLAYER_SIZE * 1.25),
        new THREE.MeshBasicMaterial({ color: 0xff052, wireframe: true })
    );

    aim = new THREE.Quaternion();
    
    velocity = new THREE.Vector3(0, 0, 0);

    isSpawned() {
        console.log('Invalid spawn check');
        return true;
    }

    emitPosition() {
        // TODO: Check if position has actually changed as an optimisation?
        window.WORLD.socket.emit('player_moved', {
            pid: this.config.player_id,
            v: this.velocity,
            p: this.handle.position,
            r: this.handle.quaternion,

            // One or both of these may be optional.
            i: this.soiChangeCount,
            soi: this.soi.name,
        });
    }
}
