export default {
  name: "Level 1: The Platform",
  description: "A simple platform floating in space",
  gravity_center: { x: 0, y: -250, z: 0 },
  
  setup(scene, physics) {
    // Set gravity center
    physics.gravity.center.set(0, -250, 0);
    
    // Main platform
    scene.createCampaignPlatform({
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 30, y: 2, z: 30 },
      material: {
        color: 0xaaaaaa,
        roughness: 0.7,
        metalness: 0.2
      }
    });
    
    // Secondary platform
    scene.createCampaignPlatform({
      position: { x: 20, y: 5, z: 0 },
      scale: { x: 10, y: 1, z: 10 },
      material: {
        color: 0x88aaff,
        roughness: 0.5,
        metalness: 0.3
      }
    });
    
    // Pushable box
    scene.createCampaignBox({
      position: { x: -10, y: 2, z: 10 },
      scale: { x: 4, y: 4, z: 4 },
      material: {
        color: 0xff8888,
        roughness: 0.8,
        metalness: 0.1
      },
      dynamic: true,
      density: 0.5
    });
    
    // Add some decorative elements
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const radius = 15;
      scene.createCampaignBox({
        position: { 
          x: Math.cos(angle) * radius, 
          y: 1, 
          z: Math.sin(angle) * radius 
        },
        scale: { x: 2, y: 2, z: 2 },
        material: {
          color: 0x666666,
          roughness: 1,
          metalness: 0
        }
      });
    }
    
    // Return spawn position
    return { x: 0, y: 5, z: 0 };
  }
};
