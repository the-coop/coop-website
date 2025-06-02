import * as THREE from 'three';

export class Pyrotechnics {
  constructor(scene) {
    this.scene = scene;
    this.activeEffects = [];
  }
  
  createExplosion(position, options = {}) {
    const {
      size = 5,
      duration = 1.0,
      color = 0xff6600,
      secondaryColor = 0xffaa00,
      particleCount = 50,
      shockwave = true,
      light = true,
      sound = true,
      type = 'default'
    } = options;
    
    const explosionGroup = new THREE.Group();
    explosionGroup.position.copy(position);
    this.scene.add(explosionGroup);
    
    // Core explosion flash
    const flashGeometry = new THREE.SphereGeometry(size * 0.3, 8, 6);
    const flashMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 3,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    explosionGroup.add(flash);
    
    // Fireball
    const fireballGeometry = new THREE.IcosahedronGeometry(size * 0.5, 1);
    const fireballMaterial = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    const fireball = new THREE.Mesh(fireballGeometry, fireballMaterial);
    explosionGroup.add(fireball);
    
    // Shockwave ring
    let shockwaveRing = null;
    if (shockwave) {
      const ringGeometry = new THREE.RingGeometry(0.1, size * 0.2, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      shockwaveRing = new THREE.Mesh(ringGeometry, ringMaterial);
      shockwaveRing.rotation.x = -Math.PI / 2;
      explosionGroup.add(shockwaveRing);
    }
    
    // Dynamic light
    let explosionLight = null;
    if (light) {
      explosionLight = new THREE.PointLight(color, size * 2, size * 10);
      explosionLight.position.copy(position);
      this.scene.add(explosionLight);
    }
    
    // Debris particles
    const particles = [];
    for (let i = 0; i < particleCount; i++) {
      const particleType = Math.random();
      let particle;
      
      if (particleType < 0.3) {
        // Sparks
        const sparkGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.4);
        const sparkMaterial = new THREE.MeshStandardMaterial({
          color: 0xffff00,
          emissive: 0xffff00,
          emissiveIntensity: 2,
          transparent: true,
          opacity: 1
        });
        particle = new THREE.Mesh(sparkGeometry, sparkMaterial);
      } else if (particleType < 0.6) {
        // Smoke puffs
        const smokeGeometry = new THREE.SphereGeometry(0.3, 4, 4);
        const smokeMaterial = new THREE.MeshBasicMaterial({
          color: 0x444444,
          transparent: true,
          opacity: 0.6
        });
        particle = new THREE.Mesh(smokeGeometry, smokeMaterial);
      } else {
        // Fire chunks
        const chunkGeometry = new THREE.TetrahedronGeometry(0.2, 0);
        const chunkMaterial = new THREE.MeshStandardMaterial({
          color: secondaryColor,
          emissive: secondaryColor,
          emissiveIntensity: 1.5,
          transparent: true,
          opacity: 0.9
        });
        particle = new THREE.Mesh(chunkGeometry, chunkMaterial);
      }
      
      // Random velocity
      const speed = size * (0.5 + Math.random() * 1.5);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      
      particle.velocity = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed,
        Math.cos(phi) * speed
      );
      
      // Add some upward bias for realism
      particle.velocity.y += size * 0.3;
      
      particle.angularVelocity = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );
      
      particle.age = 0;
      particle.maxAge = 0.5 + Math.random() * 0.5;
      particle.fadeRate = 1.0 + Math.random() * 2.0;
      
      explosionGroup.add(particle);
      particles.push(particle);
    }
    
    // Add to active effects
    const effect = {
      group: explosionGroup,
      flash,
      fireball,
      shockwaveRing,
      light: explosionLight,
      particles,
      age: 0,
      duration,
      size
    };
    
    this.activeEffects.push(effect);
    
    // Create secondary explosions for missile type
    if (type === 'missile') {
      setTimeout(() => {
        // Small secondary explosions
        for (let i = 0; i < 3; i++) {
          const offset = new THREE.Vector3(
            (Math.random() - 0.5) * size,
            (Math.random() - 0.5) * size,
            (Math.random() - 0.5) * size
          );
          this.createExplosion(position.clone().add(offset), {
            size: size * 0.3,
            duration: 0.5,
            particleCount: 10,
            shockwave: false,
            light: false
          });
        }
      }, 100);
    }
    
    return effect;
  }
  
  createMissileExplosion(position) {
    return this.createExplosion(position, {
      size: 8,
      duration: 1.5,
      color: 0xff4400,
      secondaryColor: 0xff8800,
      particleCount: 80,
      type: 'missile'
    });
  }
  
  createBulletImpact(position, normal) {
    const impactGroup = new THREE.Group();
    impactGroup.position.copy(position);
    
    // Align to surface normal
    if (normal) {
      impactGroup.lookAt(position.clone().add(normal));
    }
    
    this.scene.add(impactGroup);
    
    // Small flash
    const flashGeometry = new THREE.SphereGeometry(0.2, 4, 4);
    const flashMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    impactGroup.add(flash);
    
    // Sparks
    const sparks = [];
    for (let i = 0; i < 10; i++) {
      const sparkGeometry = new THREE.BoxGeometry(0.05, 0.05, 0.2);
      const sparkMaterial = new THREE.MeshStandardMaterial({
        color: 0xffaa00,
        emissive: 0xffaa00,
        emissiveIntensity: 2
      });
      const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
      
      // Random direction in hemisphere
      const angle = Math.random() * Math.PI * 2;
      const elevation = Math.random() * Math.PI / 2;
      const speed = 2 + Math.random() * 3;
      
      spark.velocity = new THREE.Vector3(
        Math.cos(angle) * Math.sin(elevation) * speed,
        Math.cos(elevation) * speed,
        Math.sin(angle) * Math.sin(elevation) * speed
      );
      
      if (normal) {
        spark.velocity.applyQuaternion(impactGroup.quaternion);
      }
      
      spark.age = 0;
      spark.maxAge = 0.2 + Math.random() * 0.1;
      
      impactGroup.add(spark);
      sparks.push(spark);
    }
    
    const effect = {
      group: impactGroup,
      flash,
      particles: sparks,
      age: 0,
      duration: 0.3
    };
    
    this.activeEffects.push(effect);
    return effect;
  }
  
  createFlare(position, velocity, options = {}) {
    const {
      color = 0xffaa00,
      size = 0.3,
      duration = 3.0,
      brightness = 3
    } = options;
    
    const flareGroup = new THREE.Group();
    flareGroup.position.copy(position);
    this.scene.add(flareGroup);
    
    // Main flare body
    const flareGeometry = new THREE.SphereGeometry(size, 8, 6);
    const flareMaterial = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: brightness,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending
    });
    const flare = new THREE.Mesh(flareGeometry, flareMaterial);
    flareGroup.add(flare);
    
    // Flare light
    const flareLight = new THREE.PointLight(color, brightness, 30);
    flareLight.position.copy(position);
    this.scene.add(flareLight);
    
    // Smoke trail particles
    const smokeParticles = [];
    
    const effect = {
      group: flareGroup,
      flare,
      light: flareLight,
      particles: smokeParticles,
      velocity: velocity.clone(),
      age: 0,
      duration,
      size,
      trailTimer: 0,
      position: position.clone()
    };
    
    this.activeEffects.push(effect);
    return effect;
  }
  
  createBombExplosion(position) {
    // Create a massive ground explosion
    const explosionGroup = new THREE.Group();
    explosionGroup.position.copy(position);
    this.scene.add(explosionGroup);
    
    // Multiple explosion stages
    const mainExplosion = this.createExplosion(position, {
      size: 15,
      duration: 2.0,
      color: 0xff3300,
      secondaryColor: 0xff6600,
      particleCount: 150,
      type: 'bomb'
    });
    
    // Ground shockwave
    const shockwaveGeometry = new THREE.RingGeometry(0.1, 1, 64);
    const shockwaveMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const shockwave = new THREE.Mesh(shockwaveGeometry, shockwaveMaterial);
    shockwave.rotation.x = -Math.PI / 2;
    shockwave.position.y = 0.1;
    explosionGroup.add(shockwave);
    
    // Mushroom cloud effect
    const mushroomGroup = new THREE.Group();
    explosionGroup.add(mushroomGroup);
    
    // Stem
    const stemGeometry = new THREE.CylinderGeometry(2, 4, 8, 8);
    const stemMaterial = new THREE.MeshBasicMaterial({
      color: 0x666666,
      transparent: true,
      opacity: 0.7
    });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.y = 4;
    mushroomGroup.add(stem);
    
    // Cap
    const capGeometry = new THREE.SphereGeometry(5, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const capMaterial = new THREE.MeshBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.6
    });
    const cap = new THREE.Mesh(capGeometry, capMaterial);
    cap.position.y = 8;
    mushroomGroup.add(cap);
    
    // Debris chunks
    for (let i = 0; i < 30; i++) {
      const debrisGeometry = new THREE.BoxGeometry(
        0.5 + Math.random() * 0.5,
        0.5 + Math.random() * 0.5,
        0.5 + Math.random() * 0.5
      );
      const debrisMaterial = new THREE.MeshBasicMaterial({
        color: 0x444444
      });
      const debris = new THREE.Mesh(debrisGeometry, debrisMaterial);
      
      const angle = Math.random() * Math.PI * 2;
      const force = 10 + Math.random() * 20;
      debris.velocity = new THREE.Vector3(
        Math.cos(angle) * force,
        15 + Math.random() * 10,
        Math.sin(angle) * force
      );
      debris.angularVelocity = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );
      debris.age = 0;
      debris.maxAge = 2 + Math.random();
      
      explosionGroup.add(debris);
      if (!mainExplosion.particles) mainExplosion.particles = [];
      mainExplosion.particles.push(debris);
    }
    
    // Add mushroom cloud to effect
    mainExplosion.mushroomGroup = mushroomGroup;
    mainExplosion.shockwave = shockwave;
    mainExplosion.stem = stem;
    mainExplosion.cap = cap;
    
    return mainExplosion;
  }
  
  update(deltaTime) {
    // Update all active effects
    this.activeEffects = this.activeEffects.filter(effect => {
      effect.age += deltaTime;
      const progress = effect.age / effect.duration;
      
      if (progress >= 1) {
        // Remove effect
        this.scene.remove(effect.group);
        if (effect.light) {
          this.scene.remove(effect.light);
        }
        
        // Dispose of geometries and materials
        effect.group.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        
        return false;
      }
      
      // Update flare effects
      if (effect.velocity) {
        // Update flare position
        effect.position.add(effect.velocity.clone().multiplyScalar(deltaTime));
        effect.group.position.copy(effect.position);
        if (effect.light) {
          effect.light.position.copy(effect.position);
        }
        
        // Apply gravity
        effect.velocity.y -= 15 * deltaTime;
        
        // Create smoke trail
        effect.trailTimer += deltaTime;
        if (effect.trailTimer > 0.05) {
          effect.trailTimer = 0;
          
          const smokeGeometry = new THREE.SphereGeometry(0.2 + Math.random() * 0.2, 4, 4);
          const smokeMaterial = new THREE.MeshBasicMaterial({
            color: 0x666666,
            transparent: true,
            opacity: 0.6
          });
          const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial);
          smoke.position.copy(effect.position);
          smoke.age = 0;
          smoke.maxAge = 1.5;
          smoke.growthRate = 2;
          this.scene.add(smoke);
          
          if (!effect.particles) effect.particles = [];
          effect.particles.push(smoke);
        }
        
        // Flare brightness flicker
        if (effect.flare) {
          const flicker = 0.8 + Math.random() * 0.4;
          effect.flare.material.emissiveIntensity = flicker * 3;
          if (effect.light) {
            effect.light.intensity = flicker * 3;
          }
        }
      }
      
      // Update bomb-specific effects
      if (effect.mushroomGroup) {
        // Rise and expand mushroom cloud
        effect.mushroomGroup.position.y = progress * 10;
        const scale = 1 + progress * 2;
        effect.mushroomGroup.scale.set(scale, scale * 0.7, scale);
        
        // Fade out
        if (effect.stem) {
          effect.stem.material.opacity = (1 - progress) * 0.7;
        }
        if (effect.cap) {
          effect.cap.material.opacity = (1 - progress) * 0.6;
        }
      }
      
      if (effect.shockwave) {
        const shockwaveScale = 1 + progress * 30;
        effect.shockwave.scale.set(shockwaveScale, shockwaveScale, 1);
        effect.shockwave.material.opacity = (1 - progress) * 0.6;
      }
      
      // Update main explosion elements
      if (effect.flash) {
        effect.flash.scale.setScalar(1 + progress * 2);
        effect.flash.material.opacity = 1 - progress;
      }
      
      if (effect.fireball) {
        effect.fireball.scale.setScalar(1 + progress * 1.5);
        effect.fireball.material.opacity = (1 - progress) * 0.8;
        effect.fireball.rotation.x += deltaTime * 2;
        effect.fireball.rotation.y += deltaTime * 3;
      }
      
      if (effect.shockwaveRing) {
        const ringScale = 1 + progress * effect.size * 2;
        effect.shockwaveRing.scale.set(ringScale, ringScale, 1);
        effect.shockwaveRing.material.opacity = (1 - progress) * 0.6;
      }
      
      if (effect.light) {
        effect.light.intensity = (1 - progress) * effect.size * 2;
      }
      
      // Update particles
      if (effect.particles) {
        effect.particles.forEach(particle => {
          // Skip particles that don't have required properties
          if (!particle.velocity && !particle.age) return;
          
          particle.age += deltaTime;
          
          if (particle.age < particle.maxAge) {
            // Update position only if particle has velocity
            if (particle.velocity) {
              particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));
              
              // Apply gravity
              particle.velocity.y -= 9.8 * deltaTime;
              
              // Apply drag
              particle.velocity.multiplyScalar(0.98);
            }
            
            // Update rotation
            if (particle.angularVelocity) {
              particle.rotation.x += particle.angularVelocity.x * deltaTime;
              particle.rotation.y += particle.angularVelocity.y * deltaTime;
              particle.rotation.z += particle.angularVelocity.z * deltaTime;
            }
            
            // Fade out
            if (particle.material && particle.material.opacity !== undefined) {
              const particleProgress = particle.age / particle.maxAge;
              particle.material.opacity = (1 - particleProgress) * (particle.fadeRate || 1);
            }
            
            // Scale up smoke particles
            if (particle.growthRate) {
              particle.scale.multiplyScalar(1 + deltaTime * particle.growthRate);
            }
          } else {
            particle.visible = false;
            if (particle.parent === this.scene) {
              this.scene.remove(particle);
              if (particle.geometry) particle.geometry.dispose();
              if (particle.material) particle.material.dispose();
            }
          }
        });
        
        // Remove dead particles from the array
        effect.particles = effect.particles.filter(p => !p.age || p.age < p.maxAge);
      }
      
      return true;
    });
  }
  
  clear() {
    // Remove all active effects
    this.activeEffects.forEach(effect => {
      this.scene.remove(effect.group);
      if (effect.light) {
        this.scene.remove(effect.light);
      }
      
      effect.group.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    });
    
    this.activeEffects = [];
  }
}
