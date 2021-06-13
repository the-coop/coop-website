export default class Auth {

	static TOKEN_KEY = 'discord_access_token';

	static _headers() {
		return { authorization: `Bearer: ${this._token()}` }
	}

	static _token() {
		return localStorage.get(this.TOKEN_KEY);
	}

	static setToken(token, remember = true) {
		return localStorage.set(this.TOKEN_KEY, token);
	}
}