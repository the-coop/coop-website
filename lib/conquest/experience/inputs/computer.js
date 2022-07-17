export default class ComputerInput {
	static keypad = { 
        w: false, 
        a: false, 
        s: false, 
        d: false, 
        space: false,

        // Added temporarily
        e: false
    };

    static listen() {
        const keyToggleHandler = state => ev => {
            if (ev.which == 87) this.keypad.w = state;
            else if (ev.which == 83) this.keypad.s = state;
            else if (ev.which == 65) this.keypad.a = state;
            else if (ev.which == 68) this.keypad.d = state;
            else if (ev.which == 32) this.keypad.space = state;
            // dev
            else if (ev.which == 69) this.keypad.e = state;
            return false;
        } 
        
        document.addEventListener("keydown", keyToggleHandler(true), false);
        document.addEventListener("keyup",  keyToggleHandler(false), false);
    }
};
