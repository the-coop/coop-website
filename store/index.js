export const state = () => ({
    user: 'TESTING'
});

export const mutations = {
    setUser(state, data) {
        state.user = data;
    }
};