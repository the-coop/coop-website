export default function updateOrbits() {
  const { sunSphere, moonSphere, sunPivot, earthPivot, earthGroup, timeIncrement } = window.CONQUEST;

  // Modifier for overall orbit speed.
  const orbitBaseSpeed = 10;

  // Orbital parameters in seconds.
  const earthPivotPeriod = 50 * orbitBaseSpeed;
  const sunPivotPeriod = 100 * orbitBaseSpeed;
  const earthSpherePeriod = 10 * orbitBaseSpeed;
  const moonSpherePeriod = 10 * orbitBaseSpeed;
  const sunSpherePeriod = 10 * orbitBaseSpeed;

  // Orbit the Earth around the sun.
  sunPivot.rotation.z = 2 * Math.PI * timeIncrement / sunPivotPeriod;

  // Orbit the moon around the Earth.
  earthPivot.rotation.z = 2 * Math.PI * timeIncrement / earthPivotPeriod;

  // Rotate the planets under their own motion/weight.
  earthGroup.rotation.z = 2 * Math.PI * timeIncrement / earthSpherePeriod;

  // Improve the rotations? [Later]
  moonSphere.rotation.z = 2 * Math.PI * timeIncrement / moonSpherePeriod;
  sunSphere.rotation.z = 2 * Math.PI * timeIncrement / sunSpherePeriod;
}