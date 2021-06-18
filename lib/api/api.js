import Auth from "../auth/auth";
import axios from 'axios';

export default class API {

    static BASE_URL = 'https://cooperchickenbot.herokuapp.com/';

    static configureAxiosIncludeAuthGlobally(token) {
        axios.defaults.headers.common = {'Authorization': `Bearer ${token}`}
    }

    static get(url) {
        return axios.get(this.BASE_URL + url)
    }

    static async get_json(url) {
        const response = await this.get(url);
        const result = await response.json();
        return result;
    }

    static post(url, data, config = {}) {
        return axios.post(this.BASE_URL + url, data, config);
    }
}