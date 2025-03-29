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
    static createWall(planet, ObjectData) {

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
            ObjectData.latitude,
            ObjectData.longitude,
            0   // Offset so the bottom of the wall rests on surface
        );
        
        // Add the wall to the scene and our objects array
        Engine.scene.add(wall);
        ObjectData.object = wall


        //create local matrix
        //create AABB
        const aabb = new Box3();
        const v1 = new Vector3(0, 0, 0);
        const size = new Vector3(wallWidth, wallHeight, wallDepth);
        aabb.setFromCenterAndSize(v1, size);
        ObjectData.aabb = aabb;
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

    static checkCollisions(player, Objects, timeStep) {
        let closestTime = timeStep;
        let closestobject = null;
        let closestPosition = null;

        const Speed = player.velocity.length();


        const Collision = new Vector3();


        // bad reduce using closure
        Objects.forEach((item) => {

            const Inverse = item.object.matrixWorld.clone().invert();
            
            const localRayOrigin = player.position.clone().sub(item.object.position).applyMatrix3(Inverse);
            const localRayDirection = player.velocity.clone().applyMatrix3(Inverse);
            const intersection = new Ray(localRayOrigin, localRayDirection).intersectBox(item.aabb, Collision);
            
            if (intersection) {
                // Step 3: Calculate squared distance to the intersection point
                const Time = intersection.distanceTo(localRayOrigin) / Speed;

                // Step 4: Update closest box if this intersection is closer
                if (Time < closestTime) {
                    closestTime = Time;
                    closestobject = item;
                    closestPosition = intersection.clone();
                }
            }
        });
        
        if (closestPosition == null || isNaN(closestPosition.x)) return null;
        
        const collisionPosition = closestPosition.applyMatrix4(closestobject.object.matrixWorld);
        const collisionNormal = this.getNormalFromBoundingBox(closestPosition, closestobject.aabb).applyMatrix3(closestobject.object.normalMatrix);
        
        return { collisionNormal, collisionPosition, closestobject, closestTime }
    }

}
