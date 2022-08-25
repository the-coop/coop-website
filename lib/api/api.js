import axios from 'axios';

console.log(process.env.NODE_ENV);
console.log(process.env.DEV_USE_PRODUCTION_API);
console.log(process.env.DEV_USE_PRODUCTION_API === 'TRUE');

export default class API {

    static requester = axios;

    // TODO: Add a flag to allow for usage of frontend with production backend.
    static BASE_URL = 
        (
            process.env.NODE_ENV === 'production'
            ||
            process.env.DEV_USE_PRODUCTION_API === 'TRUE'
        ) 
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