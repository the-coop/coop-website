import { BoxGeometry, MeshBasicMaterial, Mesh, Vector3, Object3D, Quaternion } from 'three';
// Removed import of constants.mjs
// import { PLAYER_RADIUS, PLAYER_HEIGHT, SPHERE_RADIUS } from '../constants.mjs';

// Update constants to match new character scale and increased sphere size
const PLAYER_RADIUS = 0.25;  // Unchanged
const PLAYER_HEIGHT = 1;     // Unchanged
const SPHERE_RADIUS = 400;   // Increased from 200 to 400

export default class PlayerManager {
    static players = [];

    static reset() {
        this.players = [];
    };

    static create(scene, camera) {
        const container = new Object3D();

        // Create a pivot for yaw rotation
        const playerPivot = new Object3D();
        container.add(playerPivot);

        // Create character mesh and add to pivot
        const playerMesh = this.createCharacter();
        playerPivot.add(playerMesh);

        // Create camera pivot as child of player pivot
        const cameraPivot = new Object3D();
        cameraPivot.position.set(0, 0.85, 0); // Align with head height
        playerPivot.add(cameraPivot);

        // Position camera and add to camera pivot
        camera.position.set(0, 0, 0.25); // Small forward offset only
        camera.rotation.set(0, 0, 0);
        cameraPivot.add(camera);

        // Create hands and attach to camera
        const hands = this.createHands();
        hands.position.set(0, -0.2, -0.3); // Adjusted to be closer to camera
        camera.add(hands); // Attach to camera instead of cameraPivot

        // Set initial position based on new SPHERE_RADIUS
        const spawnHeight = 500;  // Increased from 250 to 500 to maintain distance
        const playerPhi = Math.PI / 2;
        const playerTheta = -Math.PI / 4;
        const initialPosition = new Vector3().setFromSphericalCoords(SPHERE_RADIUS + spawnHeight, playerPhi, playerTheta);
        container.position.copy(initialPosition);

        scene.add(container);

        const player = { 
            object: container, // Add this line
            container: container,           // Root container
            pivot: playerPivot,             // Pivot for yaw
            mesh: playerMesh,               // Player mesh
            cameraPivot: cameraPivot,       // Pivot for pitch
            camera: camera,                 // Camera
            vel: new Vector3(),
            falling: false,
            surfaceNormal: container.position.clone().normalize(),
            targetQuaternion: new Quaternion(),
            leftArm: playerMesh.children[2],   // Add this line
            rightArm: playerMesh.children[3],  // Add this line
            jumping: false                     // Add this line
        };

        this.players.push(player);
        return player;
    };
    
    // Create the character body parts, including hands
    static createCharacter() {
        const bodyMaterial = new MeshBasicMaterial({ color: 0x0000ff, wireframe: true });
        const playerMesh = new Object3D();

        // Head - scaled down
        const head = new Mesh(
            new BoxGeometry(0.2, 0.2, 0.2),  // Was 0.4
            bodyMaterial
        );
        head.position.y = 0.85;  // Was 1.7
        
        // Torso - scaled down
        const torso = new Mesh(
            new BoxGeometry(0.3, 0.4, 0.15),  // Was 0.6, 0.8, 0.3
            bodyMaterial
        );
        torso.position.y = 0.55;  // Was 1.1

        // Create limb function
        const createLimb = (upperPos, lowerPos, isArm = false) => {
            const limb = new Object3D();
            const upperGeom = new BoxGeometry(
                isArm ? 0.1 : 0.125,  // Was 0.2/0.25
                0.2,                   // Was 0.4
                isArm ? 0.1 : 0.125   // Was 0.2/0.25
            );
            const lowerGeom = new BoxGeometry(
                isArm ? 0.09 : 0.115,  // Was 0.18/0.23
                0.2,                    // Was 0.4
                isArm ? 0.09 : 0.115   // Was 0.18/0.23
            );
            
            const upper = new Mesh(upperGeom, bodyMaterial);
            const lower = new Mesh(lowerGeom, bodyMaterial);
            
            upper.position.copy(upperPos);
            lower.position.copy(lowerPos);
            
            limb.add(upper);
            limb.add(lower);
            return limb;
        };

        // Arms - adjusted positions
        const leftArm = createLimb(
            new Vector3(-0.2, 0.65, 0),   // Was -0.4, 1.3, 0
            new Vector3(-0.2, 0.45, 0),   // Was -0.4, 0.9, 0
            true
        );
        const rightArm = createLimb(
            new Vector3(0.2, 0.65, 0),    // Was 0.4, 1.3, 0
            new Vector3(0.2, 0.45, 0),    // Was 0.4, 0.9, 0
            true
        );

        // Legs - adjusted positions
        const leftLeg = createLimb(
            new Vector3(-0.1, 0.3, 0),    // Was -0.2, 0.6, 0
            new Vector3(-0.1, 0.1, 0),    // Was -0.2, 0.2, 0
        );
        const rightLeg = createLimb(
            new Vector3(0.1, 0.3, 0),     // Was 0.2, 0.6, 0
            new Vector3(0.1, 0.1, 0),     // Was 0.2, 0.2, 0
        );

        // Add all parts to player mesh
        playerMesh.add(head);
        playerMesh.add(torso);
        playerMesh.add(leftArm);
        playerMesh.add(rightArm);
        playerMesh.add(leftLeg);
        playerMesh.add(rightLeg);

        // Hands are part of the playerMesh via createCharacter
        return playerMesh;
    };

    static createHands() {
        const handMaterial = new MeshBasicMaterial({ color: 0x0000ff, wireframe: true });
        const handsContainer = new Object3D();

        // Smaller hands to match character scale
        const handGeometry = new BoxGeometry(0.05, 0.05, 0.1);
        
        const leftHand = new Mesh(handGeometry, handMaterial);
        leftHand.position.set(-0.1, 0, 0);
        
        const rightHand = new Mesh(handGeometry, handMaterial);
        rightHand.position.set(0.1, 0, 0);

        handsContainer.add(leftHand);
        handsContainer.add(rightHand);
        
        return handsContainer;
    };
};
