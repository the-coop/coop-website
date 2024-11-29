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
    protagonist: null,
    isFullscreen: false,
    controlMode: 'fps', // Add default control mode
    isControllersInitialized: false // Add this line
});

// Add event handling
const listeners = new Map();

export default class State {
    static loaded = false;
    
    static setLoaded(value) {
        this.loaded = value;
    }
    
    static isLoaded() {
        return this.loaded;
    }

    static setGameStarted(value) {
        _state.isGameStarted = value;
        this.emit('stateChange', { key: 'isGameStarted', value });
    }

    static get isGameStarted() {
        return _state.isGameStarted;
    }

    static setEngineInitialized(value) {
        _state.isEngineInitialized = value;
        this.emit('stateChange', { key: 'isEngineInitialized', value });
    }

    static get isEngineInitialized() {
        return _state.isEngineInitialized;
    }

    static setMobile(value) {
        _state.isMobile = value;
        this.emit('stateChange', { key: 'isMobile', value });
    }

    static get isMobile() {
        return _state.isMobile;
    }

    static setSafari(value) {
        _state.isSafari = value;
        this.emit('stateChange', { key: 'isSafari', value });
    }

    static get isSafari() {
        return _state.isSafari;
    }

    static setShowFPS(value) {
        _state.showFPS = value;
        this.emit('stateChange', { key: 'showFPS', value });
    }

    static get showFPS() {
        return _state.showFPS;
    }

    static setPointerLockSupport(value) {
        _state.hasPointerLockSupport = value;
        this.emit('stateChange', { key: 'hasPointerLockSupport', value });
    }

    static get hasPointerLockSupport() {
        return _state.hasPointerLockSupport;
    }

    static setError(value) {
        _state.error = value;
        this.emit('stateChange', { key: 'error', value });
    }

    static get error() {
        return _state.error;
    }

    static setProtagonist(value) {
        _state.protagonist = value;
    }

    static get protagonist() {
        return _state.protagonist;
    }

    static addPlayer(id, player) {
        _state.players.set(id, player);
    }

    static removePlayer(id) {
        _state.players.delete(id);
    }

    static clearPlayers() {
        _state.players.clear();
        _state.protagonist = null;
    }

    static setFullscreen(value) {
        _state.isFullscreen = value;
        this.emit('stateChange', { key: 'isFullscreen', value });
    }
    
    static get isFullscreen() {
        return _state.isFullscreen;
    }

    static setControlMode(value) {
        _state.controlMode = value;
        this.emit('stateChange', { key: 'controlMode', value });
    }
    
    static get controlMode() {
        return _state.controlMode;
    }

    static setControllersInitialized(value) { // Add this method
        _state.isControllersInitialized = value;
        this.emit('stateChange', { key: 'isControllersInitialized', value });
    }

    static get isControllersInitialized() { // Add this getter
        return _state.isControllersInitialized;
    }

    static detectDeviceCapabilities() {
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
    }

    static handleResize() {
        const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
        const isMobileDevice = isTouchDevice && window.innerWidth <= 768;
        this.setMobile(isMobileDevice);
    }

    static on(event, callback) {
        if (!listeners.has(event)) {
            listeners.set(event, new Set());
        }
        listeners.get(event).add(callback);
    }

    static off(event, callback) {
        if (!listeners.has(event)) return;
        if (callback) {
            listeners.get(event).delete(callback);
        } else {
            listeners.delete(event);
        }
    }

    static emit(event, data) {
        if (!listeners.has(event)) return;
        listeners.get(event).forEach(callback => callback(data));
    }
}