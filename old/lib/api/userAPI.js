import API from "./api";

export default class UserAPI {

    static async get(id) {
        // this.$auth.user.id
        const userResp = await fetch(API.BASE_URL + 'members/build-single/' + id);
        return await userResp.json();
    }
    static async me($auth) {
        // this.$auth.user.id
        const userResp = await fetch(API.BASE_URL + 'members/build-single/' + $auth.$state.user?.id);
        return await userResp.json();
    }
}