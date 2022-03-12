import { 
    Mesh, SphereGeometry, MeshBasicMaterial, 
    Geometry, LineBasicMaterial, LineLoop,
    MeshPhongMaterial, Group, PointLight, Vector3,
    RingGeometry, DoubleSide, Quaternion
} from 'three';

function buildBody(item) {
    const mat = item.emissive ?
        new MeshPhongMaterial({ emissive: item.color, wireframe: false, color: item.color })
        :
        new MeshBasicMaterial({ wireframe: true, color: item.color });

    const body = new Mesh(new SphereGeometry(item.surface, 20, 20), mat);

    if (item.emissive) {
        const pointLight = new PointLight(0xffffff);
        pointLight.position.set(0, 0, 0);
        body.add(pointLight);
    }

    return body;
}

export default function buildSolarSystem(item, parent) {
    const body = buildBody(item, parent);
    body.position.set(...item.position);

    item.pivot = new Group();
    item.body = body;
    item.pivot.add(item.body);
    item.parent = parent;
    WORLD.planets.push(item);

    // Add visual rings for planets.
    if (item.ring) {
        const ring = new Mesh(
            new RingGeometry(item.surface + 1, item.surface + 1.5, 96),
            new MeshBasicMaterial({ color: 0x00ff00, side: DoubleSide })
        );
        item.body.add(ring);
        ring.rotation.x = Math.PI / 2 - 0.1;
    }

    // Add orbit path visual.
    if (parent) {
        let OrbitSise = body.position.length();

        const orbitPath = new Mesh(
            new RingGeometry(OrbitSise, OrbitSise + .05, 96),
            new MeshBasicMaterial({ color: 0xffff00, side: DoubleSide })
        );
        
        orbitPath.rotation.x = Math.PI / 2;

        parent.body.add(orbitPath);
    }

    // Recursively build children (multi-galactic support).
    item.children.map(e => {
        item.pivot.add(buildSolarSystem(e, item));
    });

    return item.pivot;
}