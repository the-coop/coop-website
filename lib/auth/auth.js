import API from '~/lib/api/api';

export default class Auth {

	static TOKEN_KEY = 'discord_access_token';

	static _header() {
		return { authorization: `Bearer ${this._token()}` }
	}

	static _me() {
		return API.get_json('https://discord.com/api/users/@me');
	}

	static _isLoggedIn() {
		return !!this._token();
	}

	static _token() {
		let token; 
		
		const localToken = window.localStorage.getItem(this.TOKEN_KEY);
		if (localToken) token = localToken;

		const sessionToken = window.sessionStorage.getItem(this.TOKEN_KEY);
		if (sessionToken) token = sessionToken;

		return token;
	}

	static setToken(token, remember = true) {
		if (remember)
			window.localStorage.setItem(this.TOKEN_KEY, token);
		else
			window.sessionStorage.setItem(this.TOKEN_KEY, token);
	}

	static logout() {
		window.localStorage.removeItem(this.TOKEN_KEY);
		window.sessionStorage.removeItem(this.TOKEN_KEY);
	}

	// Show a toast the it's detected user is no authenticated/logged in...
	// We will rely on errors for the rest :D force them to reauthenticate.
	static warn() {

	}
}