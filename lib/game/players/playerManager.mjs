import { BoxGeometry, MeshStandardMaterial, Mesh, Vector3, Object3D, Quaternion } from 'three';

const PLAYER_RADIUS = 0.25;  // Unchanged
const PLAYER_HEIGHT = 1;     // Unchanged
const SPHERE_RADIUS = 400;   // Increased from 200 to 400

export default class PlayerManager {
    static players = [];
    static protagonist = null;  // Renamed from mainPlayer

    static reset() {
        if (this.protagonist?.object?.parent) {
            this.protagonist.object.parent.remove(this.protagonist.object);
        }
        this.players = [];
        this.protagonist = null;
    }

    static create(scene, camera) {
        if (!scene || !camera) {
            console.error('Cannot create player: missing scene or camera');
            return null;
        }

        try {
            const container = new Object3D();
            container.name = 'player';
            const playerPivot = new Object3D();
            playerPivot.name = 'playerPivot';
            container.add(playerPivot);
            const playerMesh = this.createCharacter();
            if (!playerMesh) {
                throw new Error('Failed to create player mesh');
            }
            playerPivot.add(playerMesh);
            playerMesh.visible = false;
            const cameraPivot = new Object3D();
            cameraPivot.name = 'cameraPivot';
            cameraPivot.position.set(0, 0.85, 0);
            playerPivot.add(cameraPivot);
            camera.position.set(0, 0, 0);
            camera.rotation.set(0, 0, 0);
            cameraPivot.add(camera);
            const firstPersonHands = this.createFirstPersonHands();
            cameraPivot.add(firstPersonHands);
            container.position.set(0, 500, 0);
            scene.add(container);
            const player = {
                object: container,
                container: container,
                pivot: playerPivot,
                mesh: playerMesh,
                cameraPivot: cameraPivot,
                camera: camera,
                vel: new Vector3(),
                falling: false,
                surfaceNormal: new Vector3(0, 1, 0),
                targetQuaternion: new Quaternion(),
                jumping: false,
                firstPersonLeftHand: firstPersonHands.getObjectByName('firstPersonLeftHand'),
                firstPersonRightHand: firstPersonHands.getObjectByName('firstPersonRightHand'),
                input: this.input,
                speed: 5 // Reduced from 10
            };
            this.protagonist = player;
            this.players = [player];
            console.log('Player created successfully:', player);
            return player;
        } catch (error) {
            console.error('Error creating player:', error);
            return null;
        }
    }

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

    static toggleProtagonistMesh(show) {
        if (this.protagonist?.mesh) {
            this.protagonist.mesh.visible = show;
        }
    }

    static getPlayer() {
        return this.protagonist;
    }

    static input = {
        forward: false,
        back: false,
        left: false,
        right: false,
        sprint: false,
        rocket: false
    };
}