import * as THREE from 'three';

export const ENTITY_TYPES = {
    PLANETARY: "PLANETARY",
	STRUCTURE: "STRUCTURE"
};

export const BIOME_TYPES = {
	'GRASS': 'GRASS',
	'SNOW': 'SNOW',
	'SAND': 'SAND',
	'WATER': 'WATER'
}

export const BIOMES = {
	[BIOME_TYPES.GRASS]: { colour: new THREE.Color(0xC2B280) },
	[BIOME_TYPES.SNOW]: { colour: new THREE.Color(0xffffff) }, 
	[BIOME_TYPES.SAND]: { colour: new THREE.Color(0x00FF00) }, 
	[BIOME_TYPES.WATER]: { colour: new THREE.Color(0x0000ff) }
};