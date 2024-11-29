import { reactive } from 'vue';

const state = reactive({
    isGameStarted: false, // Ensure this flag exists
    isEngineInitialized: false,
    isMobile: false,
    isSafari: false,
    showFPS: false,
    hasPointerLockSupport: false,
    error: null,
    players: new Map(),
    protagonist: null,
    isFullscreen: false
});

// Add event handling
const listeners = new Map();

let isGameStarted = false;

export default {
    setGameStarted(value) {
        state.isGameStarted = value;
        this.emit('stateChange', { key: 'isGameStarted', value });
    },
    get isGameStarted() {
        return state.isGameStarted;
    },
    setEngineInitialized(value) {
        state.isEngineInitialized = value;
        this.emit('stateChange', { key: 'isEngineInitialized', value });
    },
    get isEngineInitialized() {
        return state.isEngineInitialized;
    },
    setMobile(value) {
        state.isMobile = value;
        this.emit('stateChange', { key: 'isMobile', value });
    },
    get isMobile() {
        return state.isMobile;
    },
    setSafari(value) {
        state.isSafari = value;
        this.emit('stateChange', { key: 'isSafari', value });
    },
    get isSafari() {
        return state.isSafari;
    },
    setShowFPS(value) {
        state.showFPS = value;
        this.emit('stateChange', { key: 'showFPS', value });
    },
    get showFPS() {
        return state.showFPS;
    },
    setPointerLockSupport(value) {
        state.hasPointerLockSupport = value;
        this.emit('stateChange', { key: 'hasPointerLockSupport', value });
    },
    get hasPointerLockSupport() {
        return state.hasPointerLockSupport;
    },
    setError(value) {
        state.error = value;
        this.emit('stateChange', { key: 'error', value });
    },
    get error() {
        return state.error;
    },
    setProtagonist(value) {
        state.protagonist = value;
    },
    get protagonist() {
        return state.protagonist;
    },
    addPlayer(id, player) {
        state.players.set(id, player);
    },
    removePlayer(id) {
        state.players.delete(id);
    },
    clearPlayers() {
        state.players.clear();
        state.protagonist = null;
    },
    detectDeviceCapabilities() {
        if (typeof window === 'undefined') return;

        const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
        const isMobileDevice = isTouchDevice && window.innerWidth <= 768;
        
        this.setMobile(isMobileDevice);
        this.setSafari(/^((?!chrome|android).)*safari/i.test(navigator.userAgent));
        this.setPointerLockSupport(
            'pointerLockElement' in document || 
            'webkitPointerLockElement' in document || 
            'mozPointerLockElement' in document
        );
    },
    handleResize() {
        const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
        const isMobileDevice = isTouchDevice && window.innerWidth <= 768;
        this.setMobile(isMobileDevice);
    },
    checkBrowserCapabilities() {
        const doc = document.documentElement;
        
        const fullscreenSupported = !!(
            doc.requestFullscreen ||
            doc.webkitRequestFullscreen ||
            doc.mozRequestFullScreen ||
            doc.msRequestFullscreen
        );
        
        const pointerLockSupported = !!(
            doc.requestPointerLock ||
            doc.webkitRequestPointerLock ||
            doc.mozRequestPointerLock
        );
        
        return {
            fullscreenSupported,
            pointerLockSupported
        };
    },

    // Add event handling methods
    on(event, callback) {
        if (!listeners.has(event)) {
            listeners.set(event, new Set());
        }
        listeners.get(event).add(callback);
    },

    off(event, callback) {
        if (!listeners.has(event)) return;
        if (callback) {
            listeners.get(event).delete(callback);
        } else {
            listeners.delete(event);
        }
    },

    emit(event, data) {
        if (!listeners.has(event)) return;
        listeners.get(event).forEach(callback => callback(data));
    },

    setFullscreen(value) {
        state.isFullscreen = value;
        this.emit('stateChange', { key: 'isFullscreen', value });
    },
    
    get isFullscreen() {
        return state.isFullscreen;
    }
};