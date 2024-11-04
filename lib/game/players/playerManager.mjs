import { BoxGeometry, MeshStandardMaterial, Mesh, Vector3, Object3D, Quaternion } from 'three';
    
// Update constants to match new character scale and increased sphere size
const PLAYER_RADIUS = 0.25;  // Unchanged
const PLAYER_HEIGHT = 1;     // Unchanged
const SPHERE_RADIUS = 400;   // Increased from 200 to 400

export default class PlayerManager {
    static players = [];
    static self = null; // Renamed from currentPlayer

    static reset() {
        this.players.forEach(player => {
            // Remove player objects from the scene
            if (player.object.parent) {
                player.object.parent.remove(player.object);
            }
        });
        this.players = [];
        this.self = null; // Updated
    };

    static create(scene, camera, isDummy = false) {
        const container = new Object3D();

        // Create a pivot for yaw rotation
        const playerPivot = new Object3D();
        container.add(playerPivot);

        // Create character mesh and add to pivot
        const playerMesh = this.createCharacter();
        playerPivot.add(playerMesh);

        // If main player, hide mesh for first-person view
        if (!isDummy) {
            playerMesh.visible = false; // Hide player's own mesh
        }

        // Create camera pivot as child of player pivot (only for main player)
        let cameraPivot = null;
        if (!isDummy) {
            cameraPivot = new Object3D();
            cameraPivot.position.set(0, 0.85, 0); // Align with head height
            playerPivot.add(cameraPivot);

            // Position camera and add to camera pivot
            camera.position.set(0, 0, 0.25); // Small forward offset only
            camera.rotation.set(0, 0, 0);
            cameraPivot.add(camera);
        }

        // Create hands and attach to lower arms (hidden in first-person for main player)
        const hands = this.createHands();
        const leftLowerArm = playerMesh.getObjectByName('leftArmLower');
        const rightLowerArm = playerMesh.getObjectByName('rightArmLower');
        if (leftLowerArm) leftLowerArm.add(hands.getObjectByName('leftHandContainer'));
        if (rightLowerArm) rightLowerArm.add(hands.getObjectByName('rightHandContainer'));

        // Create extra hands attached to camera (first-person view) for main player
        let firstPersonHands = null;
        if (!isDummy) {
            firstPersonHands = this.createFirstPersonHands();
            cameraPivot.add(firstPersonHands);
        }

        // Set initial position based on new SPHERE_RADIUS
        const spawnHeight = isDummy ? 0 : 500;  // Dummy players spawn on ground
        const playerPhi = isDummy ? Math.PI / 2 : Math.PI / 2;
        const playerTheta = isDummy ? 0 : -Math.PI / 4;
        const initialDistance = isDummy ? Math.random() * 100 + 50 : SPHERE_RADIUS + spawnHeight;
        const initialPosition = new Vector3().setFromSphericalCoords(initialDistance, playerPhi, playerTheta);
        container.position.copy(initialPosition);

        scene.add(container);

        const player = { 
            object: container, // Add this line
            container: container,           // Root container
            pivot: playerPivot,             // Pivot for yaw
            mesh: playerMesh,               // Player mesh
            cameraPivot: cameraPivot,       // Pivot for pitch (only main player)
            camera: camera,                 // Camera (only main player)
            vel: new Vector3(),
            falling: false,
            surfaceNormal: container.position.clone().normalize(),
            targetQuaternion: new Quaternion(),
            leftArm: playerMesh.children.find(child => child.name === 'leftArm'), // Updated
            rightArm: playerMesh.children.find(child => child.name === 'rightArm'), // Updated
            leftLeg: playerMesh.children.find(child => child.name === 'leftLeg'),
            rightLeg: playerMesh.children.find(child => child.name === 'rightLeg'),
            // Add first person hands references
            firstPersonLeftHand: firstPersonHands?.getObjectByName('firstPersonLeftHand') || null,
            firstPersonRightHand: firstPersonHands?.getObjectByName('firstPersonRightHand') || null,
            jumping: false,                     
            input: isDummy ? null : this.input  // Associate input only if main player
        };

        // Enable shadows for player mesh and its children (even if mesh is hidden)
        player.mesh.castShadow = true;
        player.mesh.receiveShadow = true;
        player.mesh.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        // Debugging Logs
        console.log('Player created with arms:', player.leftArm, player.rightArm);

        this.players.push(player);
        if (!isDummy) {
            this.self = player; // Updated
        }

        // Add dummy players for external viewing (only if main player is created)
        if (!isDummy) {
            this.addDummyPlayers(scene, 5); // Adds 5 dummy players
        }

        return player;
    };

    // Create the character body parts, including hands
    static createCharacter() {
        const bodyMaterial = new MeshStandardMaterial({ 
            color: 0x0000ff, 
            metalness: 0.5, 
            roughness: 0.5,
            wireframe: true // Enable wireframe rendering
        });
        const playerMesh = new Object3D();
        playerMesh.name = 'playerMesh';

        // Head - scaled down
        const head = new Mesh(
            new BoxGeometry(0.2, 0.2, 0.2),  // Was 0.4
            bodyMaterial
        );
        head.position.y = 0.85;  // Was 1.7
        head.name = 'head';
        
        // Torso - scaled down
        const torso = new Mesh(
            new BoxGeometry(0.3, 0.4, 0.15),  // Was 0.6, 0.8, 0.3
            bodyMaterial
        );
        torso.position.y = 0.55;  // Was 1.1
        torso.name = 'torso';

        // Create limb function with proper shoulder and elbow joints
        const createLimb = (shoulderPos, isArm = false, namePrefix = '') => {
            // Create main arm container at shoulder position
            const limb = new Object3D();
            limb.position.copy(shoulderPos);
            limb.name = namePrefix;

            // Upper arm - attach directly to shoulder
            const upperGeom = new BoxGeometry(
                isArm ? 0.1 : 0.125,
                0.2,
                isArm ? 0.1 : 0.125
            );
            const upper = new Mesh(upperGeom, bodyMaterial);
            upper.position.y = -0.1; // Center the upper arm geometry
            upper.name = `${namePrefix}Upper`;

            // Create elbow joint
            const elbow = new Object3D();
            elbow.position.y = -0.2; // Position at bottom of upper arm
            elbow.name = `${namePrefix}Elbow`;

            // Lower arm - attach to elbow
            const lowerGeom = new BoxGeometry(
                isArm ? 0.09 : 0.115,
                0.2,
                isArm ? 0.09 : 0.115
            );
            const lower = new Mesh(lowerGeom, bodyMaterial);
            lower.position.y = -0.1; // Center the lower arm geometry
            lower.name = `${namePrefix}Lower`;

            // Assemble hierarchy
            elbow.add(lower);
            upper.add(elbow);
            limb.add(upper);

            return limb;
        };

        // Arms - adjusted positions with shoulder pivots
        const leftArm = createLimb(
            new Vector3(-0.2, 0.65, 0),   // Was -0.4, 1.3, 0
            true,
            'leftArm'
        );
        const rightArm = createLimb(
            new Vector3(0.2, 0.65, 0),    // Was 0.4, 1.3, 0
            true,
            'rightArm'
        );

        // Legs - adjusted positions
        const leftLeg = createLimb(
            new Vector3(-0.1, 0.3, 0),    // Was -0.2, 0.6, 0
            false,
            'leftLeg'
        );
        const rightLeg = createLimb(
            new Vector3(0.1, 0.3, 0),     // Was 0.2, 0.6, 0
            false,
            'rightLeg'
        );

        // Add all parts to player mesh
        playerMesh.add(head);
        playerMesh.add(torso);
        playerMesh.add(leftArm);
        playerMesh.add(rightArm);
        playerMesh.add(leftLeg);
        playerMesh.add(rightLeg);

        // Hands are part of the playerMesh via createHands
        return playerMesh;
    };

    static createHands() {
        const handMaterial = new MeshStandardMaterial({ 
            color: 0x0000ff, 
            metalness: 0.5, 
            roughness: 0.5,
            wireframe: true // Enable wireframe rendering
        });
        const handsContainer = new Object3D();
        handsContainer.name = 'handsContainer';

        // Smaller hands to match character scale
        const handGeometry = new BoxGeometry(0.05, 0.05, 0.1);
        
        const leftHand = new Object3D();
        leftHand.name = 'leftHandContainer';

        const leftHandMesh = new Mesh(handGeometry, handMaterial);
        leftHandMesh.position.set(0, -0.1, 0); // Adjust position relative to lower arm
        leftHandMesh.castShadow = true;
        leftHandMesh.receiveShadow = true;
        leftHandMesh.name = 'leftHand';
        
        // Add fingers to left hand
        const createFinger = (position) => {
            const fingerGeometry = new BoxGeometry(0.02, 0.02, 0.05);
            const finger = new Mesh(fingerGeometry, handMaterial);
            finger.position.copy(position);
            finger.castShadow = true;
            finger.receiveShadow = true;
            return finger;
        };

        const leftFingers = [
            createFinger(new Vector3(-0.015, 0.03, 0.05)),
            createFinger(new Vector3(0, 0.04, 0.05)),
            createFinger(new Vector3(0.015, 0.03, 0.05)),
            createFinger(new Vector3(0.03, 0.02, 0.05))
        ];

        leftFingers.forEach(finger => leftHandMesh.add(finger));
        leftHand.add(leftHandMesh);

        const rightHand = new Object3D();
        rightHand.name = 'rightHandContainer';

        const rightHandMesh = new Mesh(handGeometry, handMaterial);
        rightHandMesh.position.set(0, -0.1, 0); // Adjust position relative to lower arm
        rightHandMesh.castShadow = true;
        rightHandMesh.receiveShadow = true;
        rightHandMesh.name = 'rightHand';

        const rightFingers = [
            createFinger(new Vector3(-0.015, 0.03, 0.05)),
            createFinger(new Vector3(0, 0.04, 0.05)),
            createFinger(new Vector3(0.015, 0.03, 0.05)),
            createFinger(new Vector3(0.03, 0.02, 0.05))
        ];

        rightFingers.forEach(finger => rightHandMesh.add(finger));
        rightHand.add(rightHandMesh);

        handsContainer.add(leftHand);
        handsContainer.add(rightHand);
        
        return handsContainer;
    };

    static createFirstPersonHands() {
        const handMaterial = new MeshStandardMaterial({ 
            color: 0xffffff, 
            metalness: 0.5, 
            roughness: 0.5,
            wireframe: false
        });
        const handsContainer = new Object3D();
        handsContainer.name = 'firstPersonHandsContainer';

        // Create hand geometry (palm) - flatter and wider
        const handGeometry = new BoxGeometry(0.06, 0.02, 0.08);
        
        // Create finger geometry - longer and thinner
        const createFinger = (position, rotation = { x: 0, y: 0, z: 0 }) => {
            const fingerGeometry = new BoxGeometry(0.015, 0.015, 0.05);
            const finger = new Mesh(fingerGeometry, handMaterial);
            finger.position.copy(position);
            finger.rotation.set(rotation.x, rotation.y, rotation.z);
            finger.castShadow = true;
            finger.receiveShadow = true;
            return finger;
        };

        // Left Hand setup
        const leftHandMesh = new Mesh(handGeometry, handMaterial);
        leftHandMesh.position.set(-0.2, -0.2, -0.3);
        leftHandMesh.rotation.set(Math.PI / 2, 0, 0); // Rotate to face away
        leftHandMesh.name = 'firstPersonLeftHand';

        // Left hand fingers and thumb
        const leftFingers = [
            createFinger(new Vector3(-0.02, 0.04, -0.01)),  // Index
            createFinger(new Vector3(0, 0.04, -0.01)),      // Middle
            createFinger(new Vector3(0.02, 0.04, -0.01)),   // Ring
            createFinger(new Vector3(0.04, 0.04, -0.01)),   // Pinky
            // Thumb - positioned at an angle
            createFinger(
                new Vector3(-0.04, 0.02, 0.02), 
                { x: 0, y: -Math.PI / 4, z: -Math.PI / 4 }
            )
        ];
        leftFingers.forEach(finger => leftHandMesh.add(finger));

        // Right Hand setup (mirrored)
        const rightHandMesh = new Mesh(handGeometry, handMaterial);
        rightHandMesh.position.set(0.2, -0.2, -0.3);
        rightHandMesh.rotation.set(Math.PI / 2, 0, 0); // Rotate to face away
        rightHandMesh.name = 'firstPersonRightHand';

        // Right hand fingers and thumb
        const rightFingers = [
            createFinger(new Vector3(0.02, 0.04, -0.01)),   // Pinky
            createFinger(new Vector3(0, 0.04, -0.01)),      // Ring
            createFinger(new Vector3(-0.02, 0.04, -0.01)),  // Middle
            createFinger(new Vector3(-0.04, 0.04, -0.01)),  // Index
            // Thumb - positioned at an angle (mirrored)
            createFinger(
                new Vector3(0.04, 0.02, 0.02), 
                { x: 0, y: Math.PI / 4, z: Math.PI / 4 }
            )
        ];
        rightFingers.forEach(finger => rightHandMesh.add(finger));

        handsContainer.add(leftHandMesh);
        handsContainer.add(rightHandMesh);
        
        return handsContainer;
    }

    /**
     * Add dummy players to the scene.
     * @param {Scene} scene - The Three.js scene.
     * @param {number} count - Number of dummy players to add.
     */
    static addDummyPlayers(scene, count = 5) {
        for (let i = 0; i < count; i++) {
            const dummy = this.create(scene, null, true); // Create as dummy
            // Position dummy randomly around the player
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 100 + 50; // 50 to 150 units away
            dummy.object.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
            scene.add(dummy.object);
            // No need to push to players array again as create() already does it
        }
    }

    /**
     * Get the main player.
     * @returns {Object} The main player object.
     */
    static getPlayer() {
        return this.self; // Updated
    }

    // Removed createDummyPlayer method

    static input = {
        forward: false,
        back: false,
        left: false,
        right: false,
        sprint: false,
        rocket: false
    };
};