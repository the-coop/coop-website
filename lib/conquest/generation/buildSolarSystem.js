import { 
    Mesh, SphereGeometry, MeshBasicMaterial, 
    Geometry, LineBasicMaterial, LineLoop,
    MeshPhongMaterial, Group, PointLight, Vector3,
  RingGeometry, DoubleSide, Quaternion, TetrahedronGeometry
} from 'three';

function buildBody(item) {
  const mat = item.emissive ?
    new MeshPhongMaterial({ emissive: item.color, wireframe: false, color: item.color })
    :
    new MeshPhongMaterial({ wireframe: false, color: item.color });

  const body = new Mesh(new SphereGeometry(item.surface, 32, 32), mat);

  if (item.emissive) {
    const pointLight = new PointLight(0xffffff);
    pointLight.position.set(0, 0, 0);
    body.add(pointLight);
  }

  return body;
}

function buildAsteroidbelt(decoration) {
  var group = new Group();



  const mat = new MeshPhongMaterial({ wireframe: false, color: 0xBBBBBB});
  let item;
  for (let i = 0; i < 80; i++) {
    item = new Mesh(new TetrahedronGeometry(Math.random() * 1, 2), mat);
    let randomvector = new Vector3();
    randomvector.x = Math.random() * 2 - 1;
    randomvector.z = Math.random() * 2 - 1;
    randomvector.normalize();
    item.position.addScaledVector(randomvector, decoration.distance * (Math.random() * 0.1 + 0.9));
    group.add(item);
  }

  return group;
}

function buildDecoration(decoration) {

  switch (decoration.type) {
    case "asteroids":
      return buildAsteroidbelt(decoration)
    default:
    // code block
  }

}

export default function buildSolarSystem(item, parent) {
  const body = buildBody(item, parent);
  body.position.set(...item.position);

  item.pivot = new Group();
  item.body = body;
  item.pivot.add(item.body);
  item.parent = parent;
  WORLD.planets.push(item);

  //Check if the parent's soi is valid. can probally remove this when generated
  if (parent && body.position.length() > parent.SOISize) {
    throw "SOI invalid";
  }

  // Add visual rings for planets.
  if (item.ring) {
    const ring = new Mesh(
      new RingGeometry(item.surface + 1, item.surface + 1.5, 96),
      new MeshPhongMaterial({ wireframe: false, color: item.color,side: DoubleSide })
    );
    item.body.add(ring);
    ring.rotation.x = Math.PI / 2 - 0.1;
  }

  // Add orbit path visual.
  if (parent) {
    let OrbitSise = body.position.length();

    const orbitPath = new Mesh(
      new RingGeometry(OrbitSise, OrbitSise + .05, 96),
      new MeshBasicMaterial({ color: 0xBBBBBB, side: DoubleSide })
    );

    orbitPath.rotation.x = Math.PI / 2;

    parent.body.add(orbitPath);
  }

  //build decorations.
  if (item.decorations) {
    item.decorations.map(e => {
      item.body.add(buildDecoration(e, item));
    });
  }

  // Recursively build children (multi-galactic support).
  item.children.map(e => {
    item.pivot.add(buildSolarSystem(e, item));
  });

  return item.pivot;
}
