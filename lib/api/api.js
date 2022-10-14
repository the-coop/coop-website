import axios from 'axios';

const NODE_ENV = process.env.NODE_ENV;
const DEV_USE_PRODUCTION_API = process.env.DEV_USE_PRODUCTION_API;

export default class API {

    static requester = axios;

    // TODO: Add a flag to allow for usage of frontend with production backend.
    static SOCKET_URL = process.env.NODE_ENV === 'production' || process.env.DEV_USE_PRODUCTION_API === 'TRUE'
        ?
        'https://us1.thecoop.group'
        :
        'http://localhost:5000/';

    // TODO: Add a flag to allow for usage of frontend with production backend.
    static BASE_URL = process.env.NODE_ENV === 'production' || process.env.DEV_USE_PRODUCTION_API === 'TRUE'
        ?
        'https://api.thecoop.group/'
        :
        'http://localhost:3000/';

    static get(url, config = {}) {
        return this.requester.get(this.BASE_URL + url, config);
    }

    static getAuthed(url, auth) {
        return this.requester.get(this.BASE_URL + url, {
            headers: {
              "Authorization": auth.strategy.token.get()
            }
        });
    }

    static post(url, data, config = {}) {
        return this.requester.post(this.BASE_URL + url, data, config);
    }

    static delete(url, config = {}) {
        return this.requester.delete(this.BASE_URL + url, config);
    }


}