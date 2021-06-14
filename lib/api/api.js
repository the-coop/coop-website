import Auth from "../auth/auth";

export default class API {

    static get(url) {
        return fetch(url, { headers: Auth._header() });
    }

    static async get_json(url) {
        const response = await this.get(url);
        const result = await response.json();
        return result;
    }
}