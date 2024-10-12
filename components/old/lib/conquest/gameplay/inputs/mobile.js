export default class MobileInput {
    static keyCodeMap = {
    }

    static inputs = { 
    };

    static keyToggleHandler = (state, inputHandler) => ({ which }) => {
        if (which in inputHandler.keyCodeMap) {
            const key = inputHandler.keyCodeMap[which];
            inputHandler.inputs[key] = state;
        }
        return false;
    }

    static listen() {
        console.log('Listening mobile inputs');

        // Add keyboard event listeners.
        // document.addEventListener("keydown", this.keyToggleHandler(true, this), false);
        // document.addEventListener("keyup",  this.keyToggleHandler(false, this), false);

        // Add mouse event listeners.
        
    }

    static destroy() {
        console.log('Remove mobile connections.');
        // document.removeEventListener("keydown", this.keyToggleHandler(true, this))
        // document.removeEventListener("keyup",  this.keyToggleHandler(false, this))
    }

    static reset() {
        this.destroy();
        this.listen();
    }

    static track(delta) {

    }
};