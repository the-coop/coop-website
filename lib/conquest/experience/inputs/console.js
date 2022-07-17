import InputManager from "../inputManager";

export default class ConsoleInput {

    static keyCodeMap = {
        87: 'w',
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
}
