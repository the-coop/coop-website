import InputManager from "../inputManager";

export default class ComputerInput {
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
        document.addEventListener("keydown", InputManager.keyToggleHandler(true, this), false);
        document.addEventListener("keyup",  InputManager.keyToggleHandler(false, this), false);
    }
};
