import { BoxGeometry, MeshBasicMaterial, Mesh, Vector3 } from 'three';

export default class GroundPlayerManager {

    static spawn(id, position, color = null) {
        // Generate geometry and materials for this player object.
        const playerGeometry = new BoxGeometry(2, 2, 2);
        const playerMaterial = new MeshBasicMaterial({ 
            color: 0x00ff00,
            wireframe: true
        });
        const playerMesh = new Mesh(playerGeometry, playerMaterial);

        // Set the position based on what the server returns.
        playerMesh.position.set(position.x, position.y, position.z);

        // Add the player to the relevent scene layer.
        window.GROUND_LEVEL.scene.add(playerMesh);

        // Add for global data access. =p
        window.GROUND_LEVEL.players[id] = {
            // Add a reference to player ID
            id: id,

            // Add mesh ID here.
            mesh_id: playerMesh.uuid,

            // Add mesh for easier testing, may be less performant for now.
            mesh: playerMesh,
            
            position,

            direction: new Vector3(0, 0, 0)
            // velocityVector: new Vector3(0, 0, 0)
        };

        return window.GROUND_LEVEL.players[id];
    }
}