import Auth from "../auth/auth";

export default class API {

    static get(url) {
        return fetch(url, { headers: { ...Auth._headers() } });
    }

    static async get_json(url) {
        const response = await this.get(url);
        const result = await response.json();

        console.log(response, result);

        return result;
    }
}