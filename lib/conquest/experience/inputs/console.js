export default class ConsoleInput {

    static keyCodeMap = {
        87: 'w',
        83: 's',
        65: 'a',
        68: 'd',
        32: 'space',
        69: 'e'
    }

	static inputs = { 
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
            if (ev.which == 87) this.inputs.w = state;
            else if (ev.which == 83) this.inputs.s = state;
            else if (ev.which == 65) this.inputs.a = state;
            else if (ev.which == 68) this.inputs.d = state;
            else if (ev.which == 32) this.inputs.space = state;
            // dev
            else if (ev.which == 69) this.inputs.e = state;
            return false;
        } 
        
        document.addEventListener("keydown", keyToggleHandler(true), false);
        document.addEventListener("keyup",  keyToggleHandler(false), false);
    }
}
