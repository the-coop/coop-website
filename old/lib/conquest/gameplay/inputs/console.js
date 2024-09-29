export default class ConsoleInput {

    static gamepad = null;

    // Used to track the previous state.
    static buttons = null;
    static axes = null;

    static inputs = {};

    static keyToggleHandler = (state, inputHandler) => ({ which }) => {
        console.log('keypress', which);
        if (which in inputHandler.keyCodeMap) {
            const key = inputHandler.keyCodeMap[which];
            inputHandler.inputs[key] = state;
        }
        return false;
    }

    static listen() {
        console.log('Listening console inputs');
        
        const gamepad = navigator.getGamepads()?.[0];
        this.gamepad = gamepad;

        console.log(gamepad);


        // Add keyboard event listeners.
        // document.addEventListener("keydown", this.keyToggleHandler(true, this), false);
        const keyupListener = document.addEventListener("keyup",  this.keyToggleHandler(false, this), false);

        // Add mouse event listeners.
        
    }

    static destroy() {
        console.log('Remove console connections.');
        // document.removeEventListener("keydown", this.keyToggleHandler(true, this))
        // document.removeEventListener("keyup",  this.keyToggleHandler(false, this))
    }

    static reset() {
        this.destroy();
        this.listen();
    }

    static track(delta) {
        console.log(this.gamepad);

        // https://w3c.github.io/gamepad/#remapping

        // this.buttons = 
        // this.axes =
    }
};