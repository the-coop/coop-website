export default {
  name: "Level 2: The Tower",
  description: "Climb the tower with planetary gravity",
  gravity_center: { x: 0, y: -250, z: 0 },
  
  setup(scene, physics) {
    // Set gravity center
    physics.gravity.center.set(0, -250, 0);
    
    // Base platform
    scene.createCampaignPlatform({
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 20, y: 2, z: 20 },
      material: {
        color: 0x888888,
        roughness: 0.7,
        metalness: 0.2
      }
    });
    
    // Create tower levels
    const levels = 5;
    const levelHeight = 8;
    
    for (let i = 1; i <= levels; i++) {
      const y = i * levelHeight;
      const size = 20 - i * 2; // Get smaller as we go up
      
      // Main platform for each level
      scene.createCampaignPlatform({
        position: { x: 0, y: y, z: 0 },
        scale: { x: size, y: 1, z: size },
        material: {
          color: `#${Math.floor(0x444444 + i * 0x111111).toString(16)}`,
          roughness: 0.7,
          metalness: 0.2
        }
      });
      
      // Add ramps between levels
      if (i < levels) {
        const rampAngle = Math.PI / 6;
        scene.createCampaignRamp({
          position: { x: size/2 - 2, y: y + levelHeight/2, z: 0 },
          scale: { x: 4, y: 0.5, z: levelHeight / Math.cos(rampAngle) },
          rotation: { x: -rampAngle, y: 0, z: 0 },
          material: {
            color: 0xaa6644,
            roughness: 0.8,
            metalness: 0.1
          }
        });
      }
      
      // Add some obstacles
      if (i > 1) {
        scene.createCampaignBox({
          position: { x: -size/2 + 3, y: y + 1.5, z: 0 },
          scale: { x: 3, y: 3, z: 3 },
          material: {
            color: 0x664444,
            roughness: 0.9,
            metalness: 0
          },
          dynamic: true,
          density: 0.8
        });
      }
    }
    
    // Add goal marker at the top
    scene.createCampaignBox({
      position: { x: 0, y: levels * levelHeight + 3, z: 0 },
      scale: { x: 2, y: 6, z: 2 },
      material: {
        color: 0xffff00,
        roughness: 0.3,
        metalness: 0.7,
        emissive: 0xffff00,
        emissiveIntensity: 0.3
      }
    });
    
    // Return spawn position
    return { x: 0, y: 3, z: 8 };
  }
};
