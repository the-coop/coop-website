export class CampaignLoader {
  static async loadLevel(levelName) {
    try {
      const module = await import(`../campaign/${levelName}.js`);
      return module.default;
    } catch (error) {
      console.error('Error loading campaign level:', error);
      throw error;
    }
  }

  static buildLevelFromData(scene, physics, levelData) {
    console.log('Building campaign level:', levelData.name);
    
    // Call the level's setup method
    if (typeof levelData.setup === 'function') {
      return levelData.setup(scene, physics);
    } else {
      console.error('Level missing setup method');
      return { x: 0, y: 5, z: 0 }; // Default spawn
    }
  }
}
