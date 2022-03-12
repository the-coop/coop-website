export default class Controls {
    static keypad = { 
        w: false, 
        a: false, 
        s: false, 
        d: false, 
        space: false 
    }
    static initialise() {    
        const keyToggleHandler = state => ev => {
            if (ev.which == 87) this.keypad.w = state;
            if (ev.which == 83) this.keypad.s = state;
            if (ev.which == 65) this.keypad.a = state;
            if (ev.which == 68) this.keypad.d = state;
            if (ev.which == 32) this.keypad.space = state;
            return false;
        } 
        
        document.addEventListener("keydown", keyToggleHandler(true), false);
        document.addEventListener("keyup",  keyToggleHandler(false), false);
    }
}