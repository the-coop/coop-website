import { reactive } from 'vue';

// Single source of truth for game state
const state = reactive({
    // Core state
    isGameStarted: false,
    isEngineInitialised: false,
    isInitialised: false,
    systemsInitialized: false,

    // Game settings
    controlMode: 'fps',
    showFPS: false,
    isFullscreen: false,

    // Device/environment state
    isMobile: false,
    isSafari: false,
    isPointerLockSupported: false,

    // Game entities
    connectedGamepads: [],

    // Game mode/stage tracking
    currentStage: '',
    mode: 'detection',

    // Logging
    initLogs: [],

    // UI-specific state
    showSettings: false,
    showHUD: false,

    // New property
    fps: 0,

    // Add protagonist to state
    protagonist: null
});

// Single export with clean interface
export default {
    // Core state getters
    get isGameStarted() { return state.isGameStarted; },
    get isEngineInitialised() { return state.isEngineInitialised; },
    get isInitialised() { return state.isInitialised; },
    get systemsInitialized() { return state.systemsInitialized; },
    
    // Game settings getters
    get controlMode() { return state.controlMode; },
    get showFPS() { return state.showFPS; },
    get isFullscreen() { return state.isFullscreen; },
    
    // Device state getters
    get isMobile() { return state.isMobile; },
    get isSafari() { return state.isSafari; },
    get isPointerLockSupported() { return state.isPointerLockSupported; },
    
    // Entity getters
    get connectedGamepads() { return state.connectedGamepads; },
    
    // Game mode/stage getters
    get currentStage() { return state.currentStage; },
    get mode() { return state.mode; },

    // UI-specific getters
    get showSettings() { return state.showSettings; },
    get showHUD() { return state.showHUD; },

    // New getter
    get fps() { return state.fps; },

    // Add protagonist getter
    get protagonist() { return state.protagonist; },

    // State setters with validation
    setGameStarted(value) { state.isGameStarted = Boolean(value); },

    setEngineInitialised(value) { state.isEngineInitialised = Boolean(value); },

    setInitialised(value) { state.isInitialised = Boolean(value); },

    setSystemsInitialized(value) { state.systemsInitialized = Boolean(value); },

    // Device state setters
    setMobile(value) { state.isMobile = Boolean(value); },

    setSafari(value) { state.isSafari = Boolean(value); },

    setPointerLockSupport(value) { state.isPointerLockSupported = Boolean(value); },

    // UI-specific setters
    setShowSettings(value) { state.showSettings = Boolean(value); },
    
    setShowHUD(value) { state.showHUD = Boolean(value); },

    // New setter
    setFPS(value) { state.fps = value; },

    // Add protagonist setter
    setProtagonist(player) { state.protagonist = player; },

    // Game state checks
    canStartGame() { return !state.isGameStarted && state.systemsInitialized; },

    // Logging methods
    addLog(message, source) { state.initLogs.push({ message, source }); },
    
    clearLogs() { state.initLogs = []; }
};