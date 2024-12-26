export default class PC {

    static onKeyDown = ev => this.active[ev.code] = true;
    static onKeyUp = ev => this.active[ev.code] = false;
    static active = {};

    static setup() {
        console.log('setting up PC controls');
        
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
    };

    static cleanup() {
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
        this.active = {};
    };

    static isKeyPressed(code) {
        return this.active[code] || false;
    };
    
};
