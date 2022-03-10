import axios from 'axios';

export default class API {

    static requester = axios;

    static BASE_URL = 'https://cooperchickenbot.herokuapp.com/';

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