<template>
  <canvas ref="canvas"></canvas>
</template>

<script setup>
  import { ref, onMounted, onBeforeUnmount } from 'vue';
  import * as THREE from 'three';
  import * as RAPIER from '@dimforge/rapier3d-compat';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

  const GRAVITY_STRENGTH = 50;
  const PLANET_RADIUS = 2;
  const PLAYER_RADIUS = 0.2;
  const PLAYER_HEIGHT = 0.8;
  const NUM_PLAYERS = 3;
  const NUM_RANDOM_OBJECTS = 8;
  const PLANET_FRICTION = 1.0;
  const OBJECT_FRICTION = 0.7;
  const MOVE_SPEED = 0.1;

  const canvas = ref(null);
  let renderer, scene, camera, physicsWorld, planetBody, planetMesh, animationFrameId;
  let controls;

  let players = [];
  let objects = [];
  let colliderToPlayerMap = new Map();
  let eventQueue;

  const keys = { w: false, a: false, s: false, d: false };
  
  const handleKeyDown = ({key}) => {
    const k = key.toLowerCase()
    if (k in keys) keys[k] = true
  };

  const handleKeyUp = ({key}) => {
    const k = key.toLowerCase()
    if (k in keys) keys[k] = false
  };

  onMounted(async () => {
    await RAPIER.init()
    
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(0, 0, 15)
    
    renderer = new THREE.WebGLRenderer({ 
      canvas: canvas.value,
      antialias: true 
    })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    
    controls = new OrbitControls(camera, canvas.value)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.screenSpacePanning = false
    controls.minDistance = 5
    controls.maxDistance = 30
    
    scene.add(new THREE.AmbientLight(0x404040))
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(10, 20, 10)
    scene.add(directionalLight)
    
    physicsWorld = new RAPIER.World({ x: 0.0, y: 0.0, z: 0.0 })
    eventQueue = new RAPIER.EventQueue(true)
    
    planetBody = physicsWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    
    const planetColliderDesc = RAPIER.ColliderDesc.ball(PLANET_RADIUS)
    planetColliderDesc.setFriction(PLANET_FRICTION)
    planetColliderDesc.setRestitution(0.0)
    physicsWorld.createCollider(planetColliderDesc, planetBody)
    
    planetMesh = new THREE.Mesh(
      new THREE.SphereGeometry(PLANET_RADIUS, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0x1565c0 })
    )
    scene.add(planetMesh)
    
    createSurfaceCubes(15)
    createPlayers(NUM_PLAYERS)
    createRandomObjects(NUM_RANDOM_OBJECTS)
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('resize', onWindowResize)
    
    scene.add(new THREE.AxesHelper(5))
    
    animate()
  });

  onBeforeUnmount(() => {
    cancelAnimationFrame(animationFrameId)
    if (renderer) renderer.dispose()
    if (controls) controls.dispose()
    
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
    window.removeEventListener('resize', onWindowResize)
  });

  function updateObjectTransform(obj) {
    if (!obj.body || !obj.mesh) return
    const pos = obj.body.translation()
    const rot = obj.body.rotation()
    obj.mesh.position.set(pos.x, pos.y, pos.z)
    obj.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w)
  }

  function createPlayers(count) {
    const playerColors = [0xe53935, 0x43A047, 0x1E88E5]
    
    for (let i = 0; i < count; i++) {
      const randomX = (Math.random() - 0.5) * 30
      const randomY = 15 + Math.random() * 15
      const randomZ = (Math.random() - 0.5) * 30
      
      const randomRotation = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        )
      )
      
      const playerRigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      playerRigidBodyDesc.setTranslation(randomX, randomY, randomZ)
      playerRigidBodyDesc.setRotation({
        x: randomRotation.x,
        y: randomRotation.y,
        z: randomRotation.z,
        w: randomRotation.w
      })
      
      const playerBody = physicsWorld.createRigidBody(playerRigidBodyDesc)
      
      const playerColliderDesc = RAPIER.ColliderDesc.capsule(PLAYER_HEIGHT / 2, PLAYER_RADIUS)
      playerColliderDesc.setFriction(0.9)  
      const collider = physicsWorld.createCollider(playerColliderDesc, playerBody)
      
      const playerMesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(PLAYER_RADIUS, PLAYER_HEIGHT, 20, 20),
        new THREE.MeshStandardMaterial({ color: playerColors[i % playerColors.length] })
      )
      scene.add(playerMesh)
      
      const player = {
        body: playerBody,
        mesh: playerMesh,
        falling: true,
        velocity: new THREE.Vector3(0, 0, 0),
        colliderHandle: collider.handle,
        index: i
      }
      
      players.push(player)
      colliderToPlayerMap.set(collider.handle, player)
    }
  };

  function createRandomObjects(count) {
    const shapes = ['box', 'sphere']
    const colors = [0xff5252, 0x7C4DFF, 0x00BFA5, 0xFFD600, 0x64DD17]
    
    for (let i = 0; i < count; i++) {
      const randomX = (Math.random() - 0.5) * 30
      const randomY = 15 + Math.random() * 15
      const randomZ = (Math.random() - 0.5) * 30
      
      const size = 0.3 + Math.random() * 1.2
      
      const shapeType = shapes[Math.floor(Math.random() * shapes.length)]
      const color = colors[Math.floor(Math.random() * colors.length)]
      
      const randomRotation = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        )
      )
      
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      bodyDesc.setTranslation(randomX, randomY, randomZ)
      bodyDesc.setRotation({
        x: randomRotation.x,
        y: randomRotation.y,
        z: randomRotation.z,
        w: randomRotation.w
      })
      
      const body = physicsWorld.createRigidBody(bodyDesc)
      
      let collider, geometry
      
      if (shapeType === 'box') {
        collider = RAPIER.ColliderDesc.cuboid(size/2, size/2, size/2)
        geometry = new THREE.BoxGeometry(size, size, size)
      } else {
        collider = RAPIER.ColliderDesc.ball(size/2)
        geometry = new THREE.SphereGeometry(size/2, 16, 16)
      }
      
      collider.setFriction(OBJECT_FRICTION)
      physicsWorld.createCollider(collider, body)
      
      const mesh = new THREE.Mesh(
        geometry, 
        new THREE.MeshStandardMaterial({ color })
      )
      scene.add(mesh)
      
      objects.push({
        body,
        mesh,
        isFixed: false,
        type: 'random'
      })
    }
  };

  function createSurfaceCubes(count) {
    const cubeSize = 0.5
    const colliderBuffer = 0.1
    
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(2 * Math.random() - 1)
      const theta = 2 * Math.PI * Math.random()
      
      const x = PLANET_RADIUS * Math.sin(phi) * Math.cos(theta)
      const y = PLANET_RADIUS * Math.sin(phi) * Math.sin(theta)
      const z = PLANET_RADIUS * Math.cos(phi)
      
      const direction = new THREE.Vector3(x, y, z).normalize()
      const position = {
        x: direction.x * (PLANET_RADIUS + cubeSize/2),
        y: direction.y * (PLANET_RADIUS + cubeSize/2),
        z: direction.z * (PLANET_RADIUS + cubeSize/2)
      }
      
      const upVector = new THREE.Vector3(0, 1, 0)
      const quaternion = new THREE.Quaternion().setFromUnitVectors(
        upVector, direction
      )
      
      const cubeRigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
      cubeRigidBodyDesc.setTranslation(position.x, position.y, position.z)
      cubeRigidBodyDesc.setRotation({
        x: quaternion.x,
        y: quaternion.y,
        z: quaternion.z,
        w: quaternion.w
      })
      
      const cubeBody = physicsWorld.createRigidBody(cubeRigidBodyDesc)
      
      const cubeColliderDesc = RAPIER.ColliderDesc.cuboid(
        cubeSize/2 + colliderBuffer,
        cubeSize/4 + colliderBuffer,
        cubeSize/2 + colliderBuffer
      )
      cubeColliderDesc.setFriction(PLANET_FRICTION)
      physicsWorld.createCollider(cubeColliderDesc, cubeBody)
      
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(cubeSize, cubeSize/2, cubeSize),
        new THREE.MeshStandardMaterial({ color: 0x8BC34A })
      )
      
      mesh.position.set(position.x, position.y, position.z)
      mesh.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
      
      scene.add(mesh)
      
      objects.push({
        body: cubeBody,
        mesh,
        isFixed: true,
        type: 'cube'
      })
    }
  };

  function positionPlayerOnSurface(player, targetBody, targetCollider = null, normal = null) {
    if (!player || !player.body || !targetBody) return null
    
    const playerPos = player.body.translation()
    const targetPos = targetBody.translation()
    
    if (!normal) {
      normal = new THREE.Vector3(
        playerPos.x - targetPos.x,
        playerPos.y - targetPos.y,
        playerPos.z - targetPos.z
      )
      
      if (normal.length() === 0) return null
      normal.normalize()
    }
    
    let offsetDistance = 0
    
    if (targetBody === planetBody) {
      offsetDistance = PLANET_RADIUS + PLAYER_HEIGHT/2 + PLAYER_RADIUS
    } 
    else if (targetCollider) {
      if (targetCollider.shapeType() === RAPIER.ShapeType.Ball) {
        offsetDistance = targetCollider.radius() + PLAYER_RADIUS
      } 
      else if (targetCollider.shapeType() === RAPIER.ShapeType.Cuboid) {
        offsetDistance = targetCollider.halfExtents().y + PLAYER_RADIUS
      }
    }
    
    const surfacePosition = {
      x: targetPos.x + normal.x * offsetDistance,
      y: targetPos.y + normal.y * offsetDistance,
      z: targetPos.z + normal.z * offsetDistance
    }
    
    player.body.setTranslation(surfacePosition)
    
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), normal
    )
    
    player.body.setRotation({
      x: quaternion.x,
      y: quaternion.y,
      z: quaternion.z,
      w: quaternion.w
    })
    
    player.velocity.set(0, 0, 0)
    
    return normal
  }

  function handleCollisions() {
    eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      const collider1 = physicsWorld.getCollider(handle1)
      const collider2 = physicsWorld.getCollider(handle2)
      if (!collider1 || !collider2) return
      
      const player = colliderToPlayerMap.get(handle1) || colliderToPlayerMap.get(handle2)
      if (!player || !started) return
      
      const otherCollider = player.colliderHandle === handle1 ? collider2 : collider1
      const otherBodyHandle = otherCollider.parent()
      const otherBody = physicsWorld.getRigidBody(otherBodyHandle)
      if (!otherBody) return
      
      if (otherBody === planetBody || otherBody.isFixed()) {
        const playerPos = player.body.translation()
        const otherPos = otherBody.translation()
        const normal = new THREE.Vector3(
          playerPos.x - otherPos.x,
          playerPos.y - otherPos.y,
          playerPos.z - otherPos.z
        ).normalize()
        
        player.falling = false
        positionPlayerOnSurface(player, otherBody, otherCollider, normal)
      }
    })
  }

  function applyGravityToObject(obj, attractor) {
    if (!obj.body || obj.isFixed) return
    
    const objectPos = obj.body.translation()
    const attractorPos = attractor.translation()
    
    const direction = new THREE.Vector3(
      attractorPos.x - objectPos.x,
      attractorPos.y - objectPos.y,
      attractorPos.z - objectPos.z
    )
    
    const distance = direction.length()
    if (distance === 0) return
    
    direction.normalize()
    const forceMagnitude = GRAVITY_STRENGTH / (distance * distance) * 0.01
    
    obj.body.applyImpulse(
      {
        x: direction.x * forceMagnitude,
        y: direction.y * forceMagnitude,
        z: direction.z * forceMagnitude
      },
      true
    )
  }

  function applyPlanetGravity() {
    for (const player of players) {
      if (!player.body || !planetBody) continue
      
      if (player.falling) {
        const playerPos = player.body.translation()
        const planetPos = planetBody.translation()
        
        const gravityDirection = new THREE.Vector3(
          planetPos.x - playerPos.x,
          planetPos.y - playerPos.y,
          planetPos.z - playerPos.z
        )
        
        const distanceToSurface = gravityDirection.length() - (PLANET_RADIUS + PLAYER_HEIGHT/2 + PLAYER_RADIUS)
        
        if (distanceToSurface <= 0.1) {
          player.falling = false
          const normal = gravityDirection.clone().normalize()
          positionPlayerOnSurface(player, planetBody, null, normal)
          continue
        }
        
        gravityDirection.normalize()
        
        const distance = new THREE.Vector3(
          planetPos.x - playerPos.x, 
          planetPos.y - playerPos.y, 
          planetPos.z - playerPos.z
        ).length()
        
        const gravitationalAcceleration = GRAVITY_STRENGTH / (distance * distance) * 0.0005
        
        player.velocity.addScaledVector(gravityDirection, gravitationalAcceleration)
        
        const speed = player.velocity.length()
        if (speed > 0.2) player.velocity.multiplyScalar(0.2 / speed)
        
        player.body.setTranslation({
          x: playerPos.x + player.velocity.x,
          y: playerPos.y + player.velocity.y,
          z: playerPos.z + player.velocity.z
        })
        
        const newPos = player.body.translation()
        const newDistToSurface = new THREE.Vector3(
          planetPos.x - newPos.x,
          planetPos.y - newPos.y,
          planetPos.z - newPos.z
        ).length() - (PLANET_RADIUS + PLAYER_HEIGHT/2 + PLAYER_RADIUS)
        
        if (newDistToSurface <= 0.05) {
          player.falling = false
          positionPlayerOnSurface(player, planetBody, null, gravityDirection.normalize())
        }
      } else {
        positionPlayerOnSurface(player, planetBody)
      }
    }
    
    objects.forEach(obj => {
      if (!obj.isFixed) applyGravityToObject(obj, planetBody)
    })
  }

  function animate() {
    animationFrameId = requestAnimationFrame(animate)
    
    applyPlanetGravity()
    physicsWorld.step(eventQueue)
    handleCollisions()
    movePlayer()
    
    for (const player of players) {
      if (!player.falling && player.body) {
        positionPlayerOnSurface(player, planetBody)
      }
      
      if (player.body) {
        const playerPos = player.body.translation()
        const planetPos = planetBody.translation()
        const distToSurface = new THREE.Vector3(
          playerPos.x - planetPos.x,
          playerPos.y - planetPos.y,
          playerPos.z - planetPos.z
        ).length() - (PLANET_RADIUS + PLAYER_HEIGHT/2 + PLAYER_RADIUS)
        
        if (player.falling && distToSurface <= 0.05) {
          player.falling = false
          const normal = new THREE.Vector3(
            playerPos.x - planetPos.x,
            playerPos.y - planetPos.y,
            playerPos.z - planetPos.z
          ).normalize()
          positionPlayerOnSurface(player, planetBody, null, normal)
        }
      }
    }
    
    controls.update()
    
    if (planetBody && planetMesh) {
      const pos = planetBody.translation()
      planetMesh.position.set(pos.x, pos.y, pos.z)
    }
    
    for (const player of players) {
      updateObjectTransform(player)
    }
    
    for (const obj of objects) {
      updateObjectTransform(obj)
    }
    
    renderer.render(scene, camera)
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }

  function movePlayer() {
    if (players.length === 0) return
    
    const player = players[0]
    if (!player || !player.body) return
    
    const playerPos = player.body.translation()
    if (!playerPos || typeof playerPos.x !== 'number') return
    
    const moveDirection = new THREE.Vector3(0, 0, 0)
    if (keys.w) moveDirection.z -= 1
    if (keys.s) moveDirection.z += 1
    if (keys.a) moveDirection.x -= 1
    if (keys.d) moveDirection.x += 1
    
    if (moveDirection.length() === 0) return
    moveDirection.normalize()
    
    if (player.falling) {
      const rotation = player.body.rotation()
      const playerQuaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
      const worldMoveDir = moveDirection.clone().applyQuaternion(playerQuaternion)
      
      const planetPos = planetBody.translation()
      const toPlanet = new THREE.Vector3(
        planetPos.x - playerPos.x, 
        planetPos.y - playerPos.y, 
        planetPos.z - playerPos.z
      )
      
      const distanceToSurface = toPlanet.length() - (PLANET_RADIUS + PLAYER_HEIGHT/2 + PLAYER_RADIUS)
      
      if (distanceToSurface <= 0.1) {
        player.falling = false
        const normal = toPlanet.clone().normalize()
        positionPlayerOnSurface(player, planetBody, null, normal)
        return
      }
      
      const newPosition = {
        x: playerPos.x + worldMoveDir.x * MOVE_SPEED * 0.5,
        y: playerPos.y + worldMoveDir.y * MOVE_SPEED * 0.5,
        z: playerPos.z + worldMoveDir.z * MOVE_SPEED * 0.5
      }
      
      player.velocity.addScaledVector(toPlanet.normalize(), 0.005)
      
      newPosition.x += player.velocity.x
      newPosition.y += player.velocity.y
      newPosition.z += player.velocity.z
      
      player.body.setTranslation(newPosition)
    } 
    else {
      const planetPos = planetBody.translation()
      const surfaceNormal = new THREE.Vector3(
        playerPos.x - planetPos.x,
        playerPos.y - planetPos.y,
        playerPos.z - planetPos.z
      ).normalize()
      
      const rotation = player.body.rotation()
      const playerQuat = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
      const playerForward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerQuat)
      
      const rightDir = new THREE.Vector3().crossVectors(playerForward, surfaceNormal).normalize()
      const adjustedForward = new THREE.Vector3().crossVectors(surfaceNormal, rightDir).normalize()
      
      const localMoveDir = new THREE.Vector3()
      if (keys.w) localMoveDir.add(adjustedForward)
      if (keys.s) localMoveDir.sub(adjustedForward)
      if (keys.a) localMoveDir.sub(rightDir)
      if (keys.d) localMoveDir.add(rightDir)
      
      if (localMoveDir.length() === 0) return
      localMoveDir.normalize()
      
      const newPosition = {
        x: playerPos.x + localMoveDir.x * MOVE_SPEED,
        y: playerPos.y + localMoveDir.y * MOVE_SPEED,
        z: playerPos.z + localMoveDir.z * MOVE_SPEED
      }
      
      const dirToSphere = new THREE.Vector3(
        newPosition.x - planetPos.x,
        newPosition.y - planetPos.y,
        newPosition.z - planetPos.z
      ).normalize()
      
      const surfacePosition = {
        x: planetPos.x + dirToSphere.x * (PLANET_RADIUS + PLAYER_HEIGHT/2 + PLAYER_RADIUS),
        y: planetPos.y + dirToSphere.y * (PLANET_RADIUS + PLAYER_HEIGHT/2 + PLAYER_RADIUS),
        z: planetPos.z + dirToSphere.z * (PLANET_RADIUS + PLAYER_HEIGHT/2 + PLAYER_RADIUS)
      }
      
      player.body.setTranslation(surfacePosition)
      
      const upVector = new THREE.Vector3(0, 1, 0)
      const alignmentQuat = new THREE.Quaternion().setFromUnitVectors(upVector, dirToSphere)
      
      const stdForward = new THREE.Vector3(0, 0, -1)
      const localForward = stdForward.clone().applyQuaternion(alignmentQuat)
      
      const angle = Math.atan2(
        new THREE.Vector3().crossVectors(localForward, localMoveDir).dot(dirToSphere),
        localForward.dot(localMoveDir)
      )
      
      const finalQuat = alignmentQuat.clone().premultiply(
        new THREE.Quaternion().setFromAxisAngle(dirToSphere, angle)
      )
      
      player.body.setRotation({
        x: finalQuat.x,
        y: finalQuat.y,
        z: finalQuat.z,
        w: finalQuat.w
      })
    }
  }
</script>

<style scoped>
  :global(html), :global(body) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100vh;
    overflow: hidden;
  }
  
  canvas {
    display: block;
    width: 100%;
    height: 100vh;
  }
</style>
