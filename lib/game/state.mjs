import { reactive } from 'vue';

const state = reactive({
    isGameStarted: false,
    isEngineInitialised: false,
    isMobile: false,
    showFPS: false,
    isFullscreen: false,
    controlMode: 'fps',
    connectedGamepads: [],
    protagonist: null,
    players: [],
    initLogs: [],
    isInitialised: false, // Renamed from isInitializing
    currentStage: '',
    mode: 'detection', // New property to manage input mode
    isSafari: false, // New property to track if browser is Safari
    isPointerLockSupported: false, // New property to track pointer lock support
});

// Enhance setter methods with validation
state.setGameStarted = (value) => {
    if (typeof value !== 'boolean') {
        console.error('setGameStarted requires a boolean value');
        return;
    }
    state.isGameStarted = value;
    // Optionally, update mode based on game started state
    state.mode = value ? 'gameplay' : 'detection';
};

state.setEngineInitialised = (value) => {
    if (typeof value !== 'boolean') {
        console.error('setEngineInitialised requires a boolean value');
        return;
    }
    state.isEngineInitialised = value;
    // Optionally, maintain consistency if needed
    // state.isInitialised = value;
};

state.setInitialised = (value) => { // Newly added method
    if (typeof value !== 'boolean') {
        console.error('setInitialised requires a boolean value');
        return;
    }
    state.isInitialised = value;
};

state.clearPlayers = () => {
    state.players = [];
};

// Modify the canStartGame method to exclude isInitialised
state.canStartGame = () => {
    return !state.isGameStarted && state.isEngineInitialised;
};

// Add logging methods
state.addLog = (message, source) => {
    state.initLogs.push({ message, source, timestamp: Date.now() });
    state.currentStage = message; // Update current stage
};

state.clearLogs = () => {
    state.initLogs = [];
    state.currentStage = '';
};

// Remove the setInitializing method as it's no longer needed
// state.setInitializing = (value) => {
//     state.isInitialised = value; // Renamed usage
// };

// Add getter/setter for protagonist
state.setProtagonist = (player) => {
    if (!player) {
        console.error('Cannot set null protagonist');
        return;
    }
    state.protagonist = player;
};

state.getProtagonist = () => {
    return state.protagonist;
};

// Add player management methods
state.addPlayer = (id, player) => {
    if (!player) return;
    state.players.push(player);
};

state.removePlayer = (playerId) => {
    state.players = state.players.filter(p => p.id !== playerId);
};

// Add the setMobile method
state.setMobile = (value) => {
    if (typeof value !== 'boolean') {
        console.error('setMobile requires a boolean value');
        return;
    }
    state.isMobile = value;
};

// Add setSafari method
state.setSafari = (value) => {
    if (typeof value !== 'boolean') {
        console.error('setSafari requires a boolean value');
        return;
    }
    state.isSafari = value;
};

// Add setPointerLockSupport method
state.setPointerLockSupport = (value) => {
    if (typeof value !== 'boolean') {
        console.error('setPointerLockSupport requires a boolean value');
        return;
    }
    state.isPointerLockSupported = value;
};

export default {
    get isGameStarted() {
        return state.isGameStarted;
    },
    get isEngineInitialised() {
        return state.isEngineInitialised;
    },
    get isInitialised() { // New getter
        return state.isInitialised;
    },
    get currentStage() {
        return state.currentStage;
    },
    get protagonist() {
        return state.protagonist;
    },
    get connectedGamepads() {
        return state.connectedGamepads;
    },
    get controlMode() {
        return state.controlMode;
    },
    get showFPS() {
        return state.showFPS;
    },
    get isFullscreen() {
        return state.isFullscreen;
    },
    get isSafari() { // Added getter for isSafari
        return state.isSafari;
    },
    get isPointerLockSupported() { // Added getter for isPointerLockSupported
        return state.isPointerLockSupported;
    },

    setGameStarted(value) {
        state.setGameStarted(value);
    },

    setEngineInitialised(value) {
        state.setEngineInitialised(value);
    },

    setInitialised(value) { // Newly added setter
        state.setInitialised(value);
    },

    setProtagonist(player) {
        state.setProtagonist(player);
    },

    getProtagonist() {
        return state.getProtagonist();
    },

    clearLogs() {
        state.clearLogs();
    },

    addLog(message, source) {
        state.addLog(message, source);
    },

    canStartGame() { // Updated method without isInitialised
        return state.canStartGame();
    },

    setMobile(value) { // Added setter for setMobile
        state.setMobile(value);
    },

    setSafari(value) { // Added setter for setSafari
        state.setSafari(value);
    },

    setPointerLockSupport(value) { // **Added** setter for setPointerLockSupport
        state.setPointerLockSupport(value);
    },

    // ...other state management methods...
};