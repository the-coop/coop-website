import { reactive } from 'vue';

// Convert to static state
const _state = reactive({
    isGameStarted: false,
    isEngineInitialized: false,
    isMobile: false,
    isSafari: false,
    showFPS: false,
    hasPointerLockSupport: false,
    error: null,
    players: new Map(),
    protagonist: null, // Keep this as a simple property
    isFullscreen: false,
    controlMode: 'fps',
    isControllersInitialized: false
});

// Add event handling
const listeners = new Map();

const State = {
    protagonist: null,
    gameStarted: false,
    controllersInitialized: false,
    controlMode: 'fps',
    isEngineInitialized: false,
    mobile: false,
    safari: false,
    pointerLockSupport: false,
    showFPS: false,
    // ...other state properties...

    setProtagonist(player) {
        this.protagonist = player;
    },
    
    setGameStarted(started) {
        this.gameStarted = started;
    },
    
    setControllersInitialized(initialized) {
        this.controllersInitialized = initialized;
    },
    
    setControlMode(mode) {
        this.controlMode = mode;
    },
    
    setEngineInitialized(initialized) {
        this.isEngineInitialized = initialized;
    },
    
    setMobile(isMobile) {
        this.mobile = isMobile;
    },
    
    setSafari(isSafari) {
        this.safari = isSafari;
    },
    
    setPointerLockSupport(support) {
        this.pointerLockSupport = support;
    },
    
    setShowFPS(show) {
        this.showFPS = show;
    },
    
    // ...other setter methods...
    
    clearPlayers() {
        this.protagonist = null;
        // Clear other player-related state if necessary
    }
    
    // ...other methods...
};

export default State;