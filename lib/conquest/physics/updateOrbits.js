const calcOrbitPos = (incr, pos) => 2 * Math.PI * incr / pos;

export default function updateOrbits() {
  const { sunSphere, moonSphere, sunPivot, earthPivot, earthGroup, timeIncrement } = window.CONQUEST;

  // Modifier for overall orbit speed.
  const orbitBaseSpeed = 10;

  // Orbital parameters in seconds.
  const sunPivotPeriod = 100 * orbitBaseSpeed;
  const earthPivotPeriod = 50 * orbitBaseSpeed;
  const earthSpherePeriod = 10 * orbitBaseSpeed;
  const moonSpherePeriod = 10 * orbitBaseSpeed;
  const sunSpherePeriod = 10 * orbitBaseSpeed;
  
  // Orbit the Earth around the sun.
  sunPivot.rotation.z = calcOrbitPos(timeIncrement, sunPivotPeriod);
  
  // Orbit the moon around the Earth.
  earthPivot.rotation.y = calcOrbitPos(timeIncrement, earthPivotPeriod);
  
  // Rotate the planets under their own motion/weight.
  earthGroup.rotation.z = calcOrbitPos(timeIncrement, earthSpherePeriod);
  moonSphere.rotation.z = calcOrbitPos(timeIncrement, moonSpherePeriod);
  sunSphere.rotation.z = calcOrbitPos(timeIncrement, sunSpherePeriod);
}
