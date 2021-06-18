// Random placeholders added only to "activate" the Vuex store.
export const state = () => ({
    counter: 0
})
  
export const mutations = {
    increment(state) {
        state.counter++
    }
}