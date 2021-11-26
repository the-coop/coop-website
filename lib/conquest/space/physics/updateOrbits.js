const calcOrbitPos = (incr, pos) => 2 * Math.PI * incr / pos;

export default function updateOrbits() {
  const { sunPivot, earthPivot, timeIncrement } = window.CONQUEST;

  // Modifier for overall orbit speed.
  const orbitBaseSpeed = 100;

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
  window.CONQUEST.SOIS.EARTH.rotation.z = calcOrbitPos(timeIncrement, earthSpherePeriod);
  window.CONQUEST.SOIS.MOON.rotation.z = calcOrbitPos(timeIncrement, moonSpherePeriod);
  window.CONQUEST.SOIS.SUN.rotation.z = calcOrbitPos(timeIncrement, sunSpherePeriod);
}
