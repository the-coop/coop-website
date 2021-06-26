import generateGroundScene from "./generateGroundScene";

export default function bootstrapGroundEngine() {
    // Used for shared state.
    window.GROUND_LEVEL = {
        // Global access to socket.
        socket: null,

        // Not really sure what else will go in here yet, prolly something fun.
        players: {},

        // Create basic scene and globalise properties
        ...generateGroundScene()
    };
}