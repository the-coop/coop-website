import { Texture, SpriteMaterial, Sprite, Vector3, Euler, Group, BoxGeometry, MeshBasicMaterial, Mesh, TextureLoader, PlaneGeometry, MeshPhongMaterial, BackSide, DoubleSide } from 'three';

import Player from '~/old/lib/conquest/players/player';
import { PLAYER_SIZE } from '../config';

import CameraManager from '../gameplay/cameraManager';
import Physics from '../physics';

export const generateCharacter = config => {
    const material = new MeshBasicMaterial({ color: 0xff0000, wireframe: true });
        
    const characterGroup = new Group;

    const bodyHeight = .08;
    const bodyWidth = .05;
    const bodyDepth = .025;
    const bodyGeometry = new BoxGeometry(bodyWidth, bodyHeight, bodyDepth);
    const body = new Mesh(bodyGeometry, material);

    const headGeometry = new BoxGeometry(bodyDepth, bodyDepth, bodyDepth);
    const head = new Mesh(headGeometry, material);

    const armGeometry = new BoxGeometry(bodyDepth / 2, bodyDepth * 2, bodyDepth / 2);
    const upperLeftArm = new Mesh(armGeometry, material);
    const lowerLeftArm = new Mesh(armGeometry, material);
    const upperRightArm = new Mesh(armGeometry, material);
    const lowerRightArm = new Mesh(armGeometry, material);

    const legGeometry = new BoxGeometry(bodyDepth / 2, bodyDepth * 3, bodyDepth / 2);
    const upperLeftLeg = new Mesh(legGeometry, material);
    const lowerLeftLeg = new Mesh(legGeometry, material);

    const upperRightLeg = new Mesh(legGeometry, material);
    const lowerRightLeg = new Mesh(legGeometry, material);

    const footGeometry = new BoxGeometry(bodyDepth / 2, bodyDepth / 2, bodyDepth / 1.75);

    const leftFoot = new Mesh(footGeometry, material);
    const rightFoot = new Mesh(footGeometry, material);

    upperLeftLeg.add(lowerLeftLeg);
    upperRightLeg.add(lowerRightLeg);
    lowerLeftLeg.add(leftFoot);
    lowerRightLeg.add(rightFoot);
    
    const rightArm = new Group;
    const leftArm = new Group;

    rightArm.add(upperRightArm);
    leftArm.add(upperLeftArm);

    upperRightArm.add(lowerRightArm);
    upperLeftArm.add(lowerLeftArm);

    body.add(
        head, 
        leftArm, rightArm, 
        upperLeftLeg, upperRightLeg
    );

    console.log(characterGroup);

    characterGroup.add(body);

    body.position.set(0, bodyHeight * 2, 0);

    head.position.set(0, bodyHeight * .55, 0);

    rightArm.position.set(bodyWidth * .55, bodyDepth / 2, 0);
    leftArm.position.set(-(bodyWidth * .55), bodyDepth / 2, 0);

    lowerLeftArm.position.set(0, -(bodyHeight / 1.5), 0);
    lowerRightArm.position.set(0, -(bodyHeight / 1.5), 0);

    upperLeftLeg.position.set(bodyHeight / 6, -bodyHeight * 1.075, 0);
    lowerLeftLeg.position.set(0, -bodyHeight, 0);

    upperRightLeg.position.set(-bodyHeight / 6, -bodyHeight * 1.075, 0);
    lowerRightLeg.position.set(0, -bodyHeight, 0);

    leftFoot.position.set(0, -bodyHeight / 2, bodyDepth / 1.75);
    rightFoot.position.set(0, -bodyHeight / 2, bodyDepth / 1.75);

    // bodyDepth
    // bodyWidth

    return characterGroup;
};

const generateLabel = (text = '???') => {
    const canvas = document.createElement('canvas');
    const size = 256; // CHANGED
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff'; // CHANGED
    context.textAlign = 'center';
    context.font = '24px Arial';
    context.fillText(text, size / 2, size / 2);

    const amap = new Texture(canvas);
    amap.needsUpdate = true;

    const mat = new SpriteMaterial({
        map: amap,
        transparent: true,
        color: 0xffffff
    });
    
    const textSprite = new Sprite(mat);
    textSprite.scale.set(7, 7, 1);
    textSprite.position.set(0, 1.75, 0);
    return textSprite;
};

export default class PlayerManager {
    static isSpawned() {
        // PlayerManager.isSpawned()
            // Spawn the player, unless unspawned.
                // TODO If player logged in spawn/re-center world.
        console.log('Invalid spawn check');
        return true;
    }

    static isSelf(player) {
        return player.config.player_id === WORLD?.me?.config?.player_id;
    }

    static remove(id) {
        // Remove the objects from the scene.
        WORLD.players[id]?.handle.remove();
        WORLD.players[id]?.mesh.remove();
        WORLD.players[id]?.character.remove();

        // Remove the remaining reference to the player.
        delete WORLD.players[id];
    }

    static async add(data) {
        // Remove so this can be used for respawning and reconnecting, allow overwrite.
        this.remove(data.player_id);

        // Create a new player instance with mesh and data.
        const player = new Player(data.player_id, data);

        WORLD.players[data.player_id] = player;

        player.handle.position.set(0, -1, -1);
        
        // Add the mesh to the handle.
        const character = generateCharacter(player.config);
        const label = generateLabel(player.config.username);

        player.character = character;
        player.handle.add(character);

        player.handle.add(player.mesh);

        player.soi = WORLD.planets[1];
        player.soi.body.add(player.handle);

        player.handle.add(label);



        // Add a sprite to player.
        // const textureLoader = new TextureLoader;
        // const texture = await textureLoader.loadAsync(items['COOP_POINT'].image);

        // const geometry = new PlaneGeometry(3, 3, 3);
        // // const material = new MeshBasicMaterial({ map: texture, transparent: true });
        // const material = new MeshPhongMaterial({ map: texture, side: DoubleSide });

        // const spriteMesh = new Mesh(geometry, material);

        // spriteMesh.position.copy(player.handle.position);
        // player.handle.add(spriteMesh);


        console.log('Added player to 3d world', data, player);


        return player;
    }

    static update() {
        Object.keys(WORLD.players).map(key => {
            const player = WORLD.players[key];
    
            let isSelf = PlayerManager.isSelf(player);
        
            // Initialise player position.
            let worldPos = new Vector3(0, 0, 1);
            player.handle.getWorldPosition(worldPos);
            let playerHeight = player.handle.position.length();
    
            // Handle SOI gravity capture.
            Physics.captureSOI(player, playerHeight, worldPos, isSelf);

            // Calculate and set up direction (forward)
            const planetWorldPos = new Vector3(0, 0, 1);
            player.soi.body.getWorldPosition(planetWorldPos);

            // Setting up and forward reference properties - maybe store on the first person controls?
            
            // Calculate a perspective relative to person standing on the ground of planet
            const altDirection = player.handle.localToWorld(new Vector3(0, 1, 0))
                .sub(worldPos).normalize();

            // Ryan, you're trying to set the up on the handle but the camera is attached to the player.mesh
            // not the player.handle ?
            player.handle.up.set(altDirection.x, altDirection.y, altDirection.z);
            
            // const t_planetWorldPos = new Vector3(0, 0, 1);
            // player.soi.body.getWorldPosition(t_planetWorldPos);
            // const planetToPlayer = player.handle.position.sub(planetWorldPos).normalize();
            // const planetToPlayer = player.handle.position.sub(planetWorldPos);
            
            // WORLD.me.player.mesh.up.set(planetToPlayer.x, planetToPlayer.y, planetToPlayer.z);

            // Look at the ground
            player.handle.lookAt(planetWorldPos);
            
            // Detect and update player grounded attribute.
            let playerBoundarySize = PLAYER_SIZE / 2;
            let surfaceHeight = player.soi.surface;
            let height = playerBoundarySize + surfaceHeight;
            const isGrounded = playerHeight <= (height + 0.0001);
            if (isGrounded && player.onGround) {

                
            } else if (isGrounded && !player.onGround) {
                // TODO: Point up away from planet floor?
                // console.log('intercepted grounding on', player.soi);
                // console.log(WORLD?.me?.player.aim);

                // Opportunity to "reground" camera so it knows what floor and ceilings are.
                if (CameraManager.isFPS())
                    WORLD.controls.regroundCamera();

                // const groundedUp = new Vector3();
                // groundedUp.subVectors(player.handle.position, player.soi.body.position).normalize().negate();
                // player.handle.up.set(groundedUp.x, groundedUp.y, groundedUp.z);

                // TODO: Set weird rotation for this event to test.
                const horizontalDirectionEuler = new Euler(20, 50, 5, 'XYZ');
                WORLD.me.player.aim.setFromEuler(horizontalDirectionEuler);

                // TODO: Set player character ground on floor
                // WORLD.me.character.rotation.set(example);
            }

            player.onGround = isGrounded;

            // Apply movement from calculations.
            const updatedPlayerHeight = Physics.applyPlayerMovement(player, playerHeight, surfaceHeight, isSelf);
    
            // Apply friction
            Physics.applyFriction(player, updatedPlayerHeight, height);
    
            // Apply first person looking to the player rotation.
            player.mesh.quaternion.copy(player.aim);
        });

        // Send own position update.
        if (WORLD.socket && WORLD?.me?.config?.player_id)
            WORLD.me.player.emitPosition();
    }

};
