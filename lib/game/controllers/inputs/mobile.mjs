export default class Mobile {
    
    static detect() {
        return 'ontouchstart' in window && window.innerWidth <= 800;
    };

    static setup() {
        console.log('Trying to setup mobile inputs.')
    };
};
