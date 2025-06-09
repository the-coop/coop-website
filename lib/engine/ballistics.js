import * as THREE from 'three';

export class Ballistics {
  /**
   * Calculate lead target position for projectile interception
   * @param {THREE.Vector3} shooterPos - Current position of shooter
   * @param {THREE.Vector3} targetPos - Current position of target
   * @param {THREE.Vector3} targetVel - Velocity of target
   * @param {number} projectileSpeed - Speed of projectile
   * @returns {THREE.Vector3|null} - Predicted intercept position or null if no solution
   */
  static calculateLeadTarget(shooterPos, targetPos, targetVel, projectileSpeed) {
    // Calculate relative position
    const relativePos = targetPos.clone().sub(shooterPos);
    
    // Quadratic equation coefficients for intercept time
    // |targetPos + targetVel * t - shooterPos| = projectileSpeed * t
    const a = targetVel.lengthSq() - projectileSpeed * projectileSpeed;
    const b = 2 * relativePos.dot(targetVel);
    const c = relativePos.lengthSq();
    
    // Solve quadratic equation
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant < 0) {
      // No intercept solution - target too fast or out of range
      return null;
    }
    
    // Calculate intercept times
    const sqrt = Math.sqrt(discriminant);
    const t1 = (-b - sqrt) / (2 * a);
    const t2 = (-b + sqrt) / (2 * a);
    
    // Use the smallest positive time
    let interceptTime;
    if (t1 > 0 && t2 > 0) {
      interceptTime = Math.min(t1, t2);
    } else if (t1 > 0) {
      interceptTime = t1;
    } else if (t2 > 0) {
      interceptTime = t2;
    } else {
      // No positive intercept time
      return null;
    }
    
    // Calculate intercept position
    return targetPos.clone().add(targetVel.clone().multiplyScalar(interceptTime));
  }
  
  /**
   * Calculate missile guidance command for proportional navigation
   * @param {THREE.Vector3} missilePos - Current missile position
   * @param {THREE.Vector3} missileVel - Current missile velocity
   * @param {THREE.Vector3} targetPos - Target position
   * @param {THREE.Vector3} targetVel - Target velocity (optional)
   * @param {number} navigationGain - Proportional navigation gain (typically 3-5)
   * @returns {THREE.Vector3} - Acceleration command vector
   */
  static calculateProportionalNavigation(missilePos, missileVel, targetPos, targetVel = null, navigationGain = 4) {
    // Line of sight vector
    const los = targetPos.clone().sub(missilePos);
    const range = los.length();
    
    if (range < 0.1) {
      // Too close, no guidance needed
      return new THREE.Vector3();
    }
    
    los.normalize();
    
    // Calculate line of sight rate
    let losRate;
    if (targetVel) {
      // True proportional navigation with target velocity
      const relativeVel = targetVel.clone().sub(missileVel);
      const closingVelocity = -relativeVel.dot(los);
      
      if (closingVelocity <= 0) {
        // Not closing on target
        return new THREE.Vector3();
      }
      
      // LOS rate = (relative velocity perpendicular to LOS) / range
      const perpVel = relativeVel.clone().sub(los.clone().multiplyScalar(relativeVel.dot(los)));
      losRate = perpVel.divideScalar(range);
    } else {
      // Pure pursuit - simplified LOS rate calculation
      const missileHeading = missileVel.clone().normalize();
      const angleToTarget = missileHeading.angleTo(los);
      const rotationAxis = new THREE.Vector3().crossVectors(missileHeading, los).normalize();
      
      if (rotationAxis.length() < 0.001) {
        // Already pointing at target
        return new THREE.Vector3();
      }
      
      losRate = rotationAxis.multiplyScalar(angleToTarget / range);
    }
    
    // Proportional navigation law: acceleration = N * closing_velocity * LOS_rate
    const missileSpeed = missileVel.length();
    const acceleration = losRate.multiplyScalar(navigationGain * missileSpeed);
    
    return acceleration;
  }
  
  /**
   * Calculate missile trajectory with gravity compensation
   * @param {THREE.Vector3} currentPos - Current position
   * @param {THREE.Vector3} currentVel - Current velocity
   * @param {THREE.Vector3} targetPos - Target position
   * @param {THREE.Vector3} gravityVector - Gravity acceleration vector
   * @param {number} thrust - Available thrust acceleration
   * @returns {THREE.Vector3} - Thrust direction vector (normalized)
   */
  static calculateGravityCompensatedTrajectory(currentPos, currentVel, targetPos, gravityVector, thrust) {
    // Calculate direct path to target
    const toTarget = targetPos.clone().sub(currentPos);
    const distance = toTarget.length();
    
    if (distance < 0.1) {
      return new THREE.Vector3(0, 1, 0); // Point up if too close
    }
    
    // Estimate time to target
    const speed = currentVel.length();
    const timeToTarget = distance / Math.max(speed, 10); // Avoid division by zero
    
    // Calculate gravity drop over flight time
    const gravityDrop = gravityVector.clone().multiplyScalar(0.5 * timeToTarget * timeToTarget);
    
    // Compensate for gravity by aiming above target
    const compensatedTarget = targetPos.clone().sub(gravityDrop);
    const desiredDirection = compensatedTarget.sub(currentPos).normalize();
    
    // Blend with velocity alignment for stability
    const velocityDir = currentVel.clone().normalize();
    const blendFactor = Math.min(distance / 50, 1); // More velocity alignment when close
    
    return desiredDirection.multiplyScalar(blendFactor)
      .add(velocityDir.multiplyScalar(1 - blendFactor))
      .normalize();
  }
  
  /**
   * Update missile with homing behavior
   * @param {Object} missile - Missile object with physics body
   * @param {Object} physics - Physics system reference
   * @param {number} deltaTime - Time step
   * @returns {Object} - Updated guidance data
   */
  static updateHomingMissile(missile, physics, deltaTime) {
    if (!missile.lockedTarget || !missile.guidanceActive) {
      return { guided: false };
    }
    
    // Get current missile state
    const position = missile.body.translation();
    const velocity = missile.body.linvel();
    const missilePos = new THREE.Vector3(position.x, position.y, position.z);
    const missileVel = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
    
    // Get target position and velocity
    let targetPos, targetVel;
    if (missile.lockedTarget.getPosition) {
      targetPos = missile.lockedTarget.getPosition();
      targetVel = missile.lockedTarget.getVelocity ? missile.lockedTarget.getVelocity() : new THREE.Vector3();
    } else {
      // Lost target
      missile.guidanceActive = false;
      return { guided: false };
    }
    
    // Calculate range to target
    const range = missilePos.distanceTo(targetPos);
    
    // Deactivate guidance if too close (let momentum carry it)
    if (range < 5) {
      missile.guidanceActive = false;
      return { guided: false, range: range };
    }
    
    // Get gravity vector
    const gravityDir = new THREE.Vector3()
      .subVectors(physics.gravity.center, missilePos)
      .normalize();
    const gravityStrength = physics.gravity.strength;
    const gravityAccel = gravityDir.multiplyScalar(gravityStrength);
    
    // Calculate guidance command using proportional navigation
    const guidanceAccel = this.calculateProportionalNavigation(
      missilePos,
      missileVel,
      targetPos,
      targetVel,
      missile.navigationGain || 4
    );
    
    // Calculate thrust direction with gravity compensation
    const thrustDir = this.calculateGravityCompensatedTrajectory(
      missilePos,
      missileVel,
      targetPos,
      gravityAccel,
      missile.thrustForce || 50
    );
    
    // Apply thrust force
    const thrustForce = thrustDir.multiplyScalar(missile.thrustForce || 50);
    
    // Combine thrust with guidance
    const totalForce = thrustForce.add(guidanceAccel.multiplyScalar(missile.body.mass()));
    
    // Apply force to missile
    missile.body.addForce({
      x: totalForce.x,
      y: totalForce.y,
      z: totalForce.z
    });
    
    // Update missile rotation to face velocity direction
    const speed = missileVel.length();
    if (speed > 0.1) {
      const direction = missileVel.clone().normalize();
      const quaternion = new THREE.Quaternion();
      
      // Create rotation from forward (0,0,1) to velocity direction
      const forward = new THREE.Vector3(0, 0, 1);
      quaternion.setFromUnitVectors(forward, direction);
      
      // Apply rotation with smoothing
      const currentQuat = new THREE.Quaternion(
        missile.body.rotation().x,
        missile.body.rotation().y,
        missile.body.rotation().z,
        missile.body.rotation().w
      );
      
      // Slerp for smooth rotation
      currentQuat.slerp(quaternion, Math.min(deltaTime * 10, 1));
      
      missile.body.setRotation({
        x: currentQuat.x,
        y: currentQuat.y,
        z: currentQuat.z,
        w: currentQuat.w
      });
    }
    
    return {
      guided: true,
      range: range,
      targetPos: targetPos,
      guidanceForce: totalForce
    };
  }
  
  /**
   * Calculate bullet trajectory with gravity and drag
   * @param {THREE.Vector3} origin - Fire position
   * @param {THREE.Vector3} direction - Fire direction (normalized)
   * @param {number} muzzleVelocity - Initial bullet speed
   * @param {THREE.Vector3} gravityVector - Gravity acceleration
   * @param {number} distance - Target distance
   * @param {number} dragCoefficient - Air resistance (optional)
   * @returns {Object} - Trajectory data including aim offset
   */
  static calculateBulletTrajectory(origin, direction, muzzleVelocity, gravityVector, distance, dragCoefficient = 0) {
    // Time of flight estimation
    const timeOfFlight = distance / muzzleVelocity;
    
    // Gravity drop
    const drop = gravityVector.clone().multiplyScalar(0.5 * timeOfFlight * timeOfFlight);
    
    // Calculate aim offset to compensate
    const aimOffset = drop.clone().multiplyScalar(-1 / distance);
    
    // Adjusted aim direction
    const compensatedDirection = direction.clone().add(aimOffset).normalize();
    
    return {
      timeOfFlight: timeOfFlight,
      drop: drop,
      aimOffset: aimOffset,
      compensatedDirection: compensatedDirection
    };
  }
  
  /**
   * Check if a target is within a cone of vision
   * @param {THREE.Vector3} observerPos - Observer position
   * @param {THREE.Vector3} observerForward - Observer forward direction (normalized)
   * @param {THREE.Vector3} targetPos - Target position
   * @param {number} coneAngle - Half angle of cone in radians
   * @param {number} maxRange - Maximum detection range
   * @returns {Object} - Detection result with angle and range
   */
  static checkTargetInCone(observerPos, observerForward, targetPos, coneAngle, maxRange) {
    const toTarget = targetPos.clone().sub(observerPos);
    const range = toTarget.length();
    
    if (range > maxRange) {
      return { inCone: false, range: range, angle: null };
    }
    
    const angle = observerForward.angleTo(toTarget.normalize());
    const inCone = angle <= coneAngle;
    
    return {
      inCone: inCone,
      range: range,
      angle: angle,
      normalizedDirection: toTarget
    };
  }
  
  /**
   * Calculate optimal launch angle for ballistic trajectory
   * @param {number} range - Horizontal distance to target
   * @param {number} heightDiff - Vertical distance to target (positive = target higher)
   * @param {number} velocity - Launch velocity
   * @param {number} gravity - Gravity acceleration magnitude
   * @returns {number|null} - Launch angle in radians or null if no solution
   */
  static calculateBallisticAngle(range, heightDiff, velocity, gravity) {
    const v2 = velocity * velocity;
    const v4 = v2 * v2;
    const g = gravity;
    const x = range;
    const y = heightDiff;
    
    // Ballistic equation discriminant
    const discriminant = v4 - g * (g * x * x + 2 * y * v2);
    
    if (discriminant < 0) {
      // Target out of range
      return null;
    }
    
    // Two possible angles (high and low trajectory)
    const sqrt = Math.sqrt(discriminant);
    const angle1 = Math.atan((v2 + sqrt) / (g * x));
    const angle2 = Math.atan((v2 - sqrt) / (g * x));
    
    // Return the lower angle (more direct path)
    return Math.min(angle1, angle2);
  }
  
  /**
   * Predict future position of a moving target
   * @param {THREE.Vector3} targetPos - Current target position
   * @param {THREE.Vector3} targetVel - Target velocity
   * @param {number} predictionTime - Time to predict ahead
   * @param {THREE.Vector3} targetAccel - Target acceleration (optional)
   * @returns {THREE.Vector3} - Predicted position
   */
  static predictTargetPosition(targetPos, targetVel, predictionTime, targetAccel = null) {
    const predicted = targetPos.clone();
    
    // Add velocity contribution
    predicted.add(targetVel.clone().multiplyScalar(predictionTime));
    
    // Add acceleration contribution if provided
    if (targetAccel) {
      predicted.add(targetAccel.clone().multiplyScalar(0.5 * predictionTime * predictionTime));
    }
    
    return predicted;
  }
  
  /**
   * Update physics-based missile with guidance and thrust
   * @param {Object} missile - Missile object with physics body
   * @param {Object} physics - Physics system reference
   * @param {number} deltaTime - Time step
   * @param {THREE.Vector3} gravityVector - Gravity acceleration vector
   * @returns {boolean} - True if missile should continue, false if detonated
   */
  static updatePhysicsBasedMissile(missile, physics, deltaTime, gravityVector) {
    if (!missile.body || !physics.world.bodies.contains(missile.body.handle)) {
      return false;
    }
    
    // Check lifetime
    const age = (Date.now() - missile.startTime) / 1000;
    if (age > (missile.lifetime / 1000)) {
      return false;
    }
    
    // Get current state
    const bodyPos = missile.body.translation();
    const bodyVel = missile.body.linvel();
    const currentSpeed = Math.sqrt(bodyVel.x * bodyVel.x + bodyVel.y * bodyVel.y + bodyVel.z * bodyVel.z);
    
    // Calculate thrust force
    let thrustDir = new THREE.Vector3(bodyVel.x, bodyVel.y, bodyVel.z);
    if (currentSpeed > 0.1) {
      thrustDir.normalize();
    } else {
      // Use missile's forward direction if velocity is too low
      thrustDir.copy(missile.direction);
    }
    
    // Apply guidance if we have a locked target
    if (missile.guidanceActive && missile.lockedTarget && missile.lockedTarget.getPosition) {
      const targetPos = missile.lockedTarget.getPosition();
      const missilePos = new THREE.Vector3(bodyPos.x, bodyPos.y, bodyPos.z);
      const missileVel = new THREE.Vector3(bodyVel.x, bodyVel.y, bodyVel.z);
      
      // Get target velocity if available
      let targetVel = null;
      if (missile.lockedTarget.getVelocity) {
        targetVel = missile.lockedTarget.getVelocity();
      }
      
      // Calculate proportional navigation guidance
      const guidanceCommand = this.calculateProportionalNavigation(
        missilePos,
        missileVel,
        targetPos,
        targetVel,
        missile.navigationGain || 4
      );
      
      // Blend thrust direction with guidance command
      const blendFactor = Math.min(missile.trackingStrength || 0.5, 1.0);
      thrustDir.lerp(guidanceCommand.normalize(), blendFactor);
      thrustDir.normalize();
      
      // Check proximity fuse
      const distanceToTarget = missilePos.distanceTo(targetPos);
      if (distanceToTarget < missile.proximityFuseRange) {
        console.log('Proximity fuse triggered at distance:', distanceToTarget);
        return false;
      }
    }
    
    // Apply thrust force
    const thrustForce = thrustDir.multiplyScalar(missile.thrustForce || 60);
    missile.body.addForce({
      x: thrustForce.x,
      y: thrustForce.y,
      z: thrustForce.z
    }, true);
    
    // Limit max speed
    if (currentSpeed > missile.maxSpeed) {
      const limitedVel = new THREE.Vector3(bodyVel.x, bodyVel.y, bodyVel.z)
        .normalize()
        .multiplyScalar(missile.maxSpeed);
      missile.body.setLinvel({
        x: limitedVel.x,
        y: limitedVel.y,
        z: limitedVel.z
      }, true);
    }
    
    // Update missile rotation to face velocity direction
    if (currentSpeed > 0.1) {
      const velocityDir = new THREE.Vector3(bodyVel.x, bodyVel.y, bodyVel.z).normalize();
      const quaternion = new THREE.Quaternion();
      const matrix = new THREE.Matrix4();
      matrix.lookAt(
        new THREE.Vector3(0, 0, 0),
        velocityDir,
        new THREE.Vector3(0, 1, 0)
      );
      quaternion.setFromRotationMatrix(matrix);
      
      missile.body.setRotation({
        x: quaternion.x,
        y: quaternion.y,
        z: quaternion.z,
        w: quaternion.w
      }, true);
    }
    
    return true;
  }
  
  /**
   * Check missile proximity detonation
   * @param {Object} missile - Missile object
   * @param {THREE.Vector3} targetPosition - Target position
   * @param {number} proximityRange - Detonation range
   * @returns {boolean} - True if should detonate
   */
  static checkProximityDetonation(missile, targetPosition, proximityRange = 5.0) {
    if (!missile.lockedTarget || missile.hasDetonated) return false;
    
    const distance = missile.position.distanceTo(targetPosition);
    return distance <= proximityRange;
  }
  
  /**
   * Calculate optimal missile intercept trajectory
   * @param {THREE.Vector3} missilePos - Current missile position
   * @param {THREE.Vector3} missileVel - Current missile velocity
   * @param {THREE.Vector3} targetPos - Target position
   * @param {THREE.Vector3} targetVel - Target velocity
   * @param {number} missileSpeed - Maximum missile speed
   * @returns {THREE.Vector3} - Intercept direction vector
   */
  static calculateMissileIntercept(missilePos, missileVel, targetPos, targetVel, missileSpeed) {
    // Calculate lead target position
    const leadTarget = this.calculateLeadTarget(missilePos, targetPos, targetVel || new THREE.Vector3(), missileSpeed);
    
    if (leadTarget) {
      // Direction to intercept point
      return new THREE.Vector3().subVectors(leadTarget, missilePos).normalize();
    } else {
      // Fallback to direct pursuit
      return new THREE.Vector3().subVectors(targetPos, missilePos).normalize();
    }
  }
}
