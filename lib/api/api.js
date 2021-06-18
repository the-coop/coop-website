import axios from 'axios';

export default class API {

    static requester = axios;

    static BASE_URL = 'https://cooperchickenbot.herokuapp.com/';

    static configureAxiosIncludeAuthGlobally(token) {
        this.requester.defaults.headers.common = {'Authorization': `Bearer ${token}`}
    }

    static get(url, config) {
        return this.requester.get(this.BASE_URL + url, config);
    }

    static post(url, data, config = {}) {
        return this.requester.post(this.BASE_URL + url, data, config);
    }
}