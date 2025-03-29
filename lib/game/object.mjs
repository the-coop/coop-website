import { 
    BoxGeometry, 
    Mesh, 
    MeshBasicMaterial, 
    Vector3,
    Quaternion,
    Matrix4,
    Box3,
    Ray
} from 'three';
import { OBB } from 'three/addons/math/OBB.js';
import Engine from './engine.mjs';
import SceneManager from './scene.mjs';


// Manages objects placed on planetary surfaces like walls, structures, etc.
export default class ObjectManager {
    
    // Create a single wall on a planet at the specified latitude and longitude
    static createWall(planet, objectData) {

        const planetRadius = planet.radius;
        const wallHeight = planetRadius * 0.05; // 5% of planet radius
        const wallWidth = planetRadius * 0.2;   // 20% of planet radius
        const wallDepth = planetRadius * 0.2;  // 1% of planet radius


        // Create the wall geometry
        const geometry = new BoxGeometry(wallWidth, wallHeight, wallDepth);
        const material = new MeshBasicMaterial({ 
            color: 0x8844aa, 
            wireframe: true 
        });
        
        const wall = new Mesh(geometry, material);
        
        // Position the wall on the planet surface
        this.positionObjectOnPlanet(
            wall,
            planet,
            objectData.latitude,
            objectData.longitude,
            0   // Offset so the bottom of the wall rests on surface
        );
        
        // Add the wall to the scene and our objects array
        Engine.scene.add(wall);
        objectData.object = wall


        //create local matrix
        //create AABB
        const aabb = new Box3();
        const v1 = new Vector3(0, 0, 0);
        const size = new Vector3(wallWidth, wallHeight, wallDepth);
        aabb.setFromCenterAndSize(v1, size);
        objectData.aabb = aabb;
        return wall;
    }
    


    // Position an object on a planet's surface at given latitude/longitude
    static positionObjectOnPlanet(object, planet, latitude, longitude, heightOffset = 0) {
        // Fix: Use planet.radius directly instead of planet.geometry.parameters.radius
        const planetRadius = planet.radius;

        // Convert lat/long to radians
        const latRad = latitude * (Math.PI / 180);
        const longRad = longitude * (Math.PI / 180);

        // Calculate position on sphere
        const x = planetRadius * Math.cos(latRad) * Math.cos(longRad);
        const y = planetRadius * Math.sin(latRad);
        const z = planetRadius * Math.cos(latRad) * Math.sin(longRad);

        // Position relative to planet center
        const position = new Vector3(x, y, z);

        // Create orientation matrix to align with planet surface
        // This makes the object's "up" direction point away from planet center
        const surfaceNormal = position.clone().normalize();
        const objectUp = new Vector3(0, 1, 0); // Default up direction

        // Create quaternion to rotate from default orientation to surface orientation
        const alignmentQuaternion = new Quaternion();



        // Find rotation axis and angle between default up and surface normal
        const rotationAxis = new Vector3().crossVectors(objectUp, surfaceNormal).normalize();
        const angle = Math.acos(objectUp.dot(surfaceNormal));

        // Set quaternion from axis and angle
        if (rotationAxis.length() > 0.001) { // Avoid zero-length rotation axis
            alignmentQuaternion.setFromAxisAngle(rotationAxis, angle);
        }

        // Apply rotation to align with surface
        object.quaternion.copy(alignmentQuaternion);

        // Add height offset along the normal direction
        const offsetPosition = position.clone().add(
            surfaceNormal.clone().multiplyScalar(heightOffset)
        );

        // Position the object (relative to planet position)
        // Fix: Use planet.object.position instead of planet.position
        object.position.copy(planet.object.position).add(offsetPosition);
    }

    static getNormalFromBoundingBox(position, boundingBox) {
        // Get the center of the bounding box
        const center = new Vector3();
        boundingBox.getCenter(center);
        
        // Get the size of the bounding box
        const size = new Vector3();
        boundingBox.getSize(size);
        
        // Calculate the direction from center to hit position
        const direction = new Vector3().subVectors(position, center);
        
        // Compute normalized distances to each face
        const normalizedDist = new Vector3(
            Math.abs(direction.x) / (size.x * 0.5),
            Math.abs(direction.y) / (size.y * 0.5),
            Math.abs(direction.z) / (size.z * 0.5)
        );
        
        // The normal is perpendicular to the face that was hit
        // The face with normalized distance closest to 1 is the hit face
        const normal = new Vector3();
        
        if (normalizedDist.x > normalizedDist.y && normalizedDist.x > normalizedDist.z) {
            // X face was hit
            normal.set(Math.sign(direction.x), 0, 0);
        } else if (normalizedDist.y > normalizedDist.x && normalizedDist.y > normalizedDist.z) {
            // Y face was hit
            normal.set(0, Math.sign(direction.y), 0);
        } else {
            // Z face was hit
            normal.set(0, 0, Math.sign(direction.z));
        }
        
        return normal;
    }

    static checkCollisions(player, objects, timeStep) {
        if (!objects || objects.length === 0) return null;
        
        let closestTime = timeStep;
        let closestObject = null;
        let closestPosition = null;

        const speed = player.velocity.length();
        if (speed === 0) return null; // No movement, no collision
        
        const collision = new Vector3();

        objects.forEach((item) => {
            if (!item.object || !item.aabb) return; // Skip invalid objects
            
            // Get the inverse world matrix of the object
            const inverse = item.object.matrixWorld.clone().invert();
            
            // Transform player position to object's local space
            const localRayOrigin = player.position.clone().applyMatrix4(inverse);
            
            // Transform velocity to object's local space without normalizing
            const localRayDirection = player.velocity.clone().applyMatrix4(inverse);
            localRayDirection.normalize(); // Normalize after transformation
            
            // Cast ray against the box
            const ray = new Ray(localRayOrigin, localRayDirection);
            const intersection = ray.intersectBox(item.aabb, collision);
            
            if (intersection) {
                // Calculate time to intersection based on distance and speed
                const distToIntersection = localRayOrigin.distanceTo(intersection);
                const time = distToIntersection / speed;
                
                // Only count collisions that happen within this time step
                if (time <= timeStep && time < closestTime) {
                    closestTime = time;
                    closestObject = item;
                    closestPosition = intersection.clone();
                }
            }
        });
        
        if (closestPosition === null || isNaN(closestPosition.x)) return null;
        
        // Transform collision position back to world space
        const collisionPosition = new Vector3().copy(closestPosition);
        collisionPosition.applyMatrix4(closestObject.object.matrixWorld);
        
        // Get normal and transform it correctly to world space
        const collisionNormal = this.getNormalFromBoundingBox(closestPosition, closestObject.aabb)
            .applyQuaternion(closestObject.object.quaternion)
            .normalize();
        
        return { collisionNormal, collisionPosition, closestObject, closestTime };
    }

    // Create a collision box for any object (walls, vehicles, etc.)
    static createCollisionBox(object, width, height, depth) {
        const aabb = new Box3();
        const center = new Vector3(0, 0, 0);
        const size = new Vector3(width, height, depth);
        aabb.setFromCenterAndSize(center, size);
        return aabb;
    }
}
