export default class Auth {

	static TOKEN_KEY = 'discord_access_token';

	static _headers() {
		return { authorization: `Bearer: ${this._token()}` }
	}

	static _token() {
		let token; 
		
		const localToken = window.localStorage.get(this.TOKEN_KEY);
		if (localToken) token = localToken;

		const sessionToken = window.sessionStorage.get(this.TOKEN_KEY);
		if (sessionToken) token = sessionToken;

		return token;
	}

	static setToken(token, remember = true) {
		if (remember)
			window.localStorage.set(this.TOKEN_KEY, token);
		else
			window.sessionStorage.set(this.TOKEN_KEY, token);
	}


	// Show a toast the it's detected user is no authenticated/logged in...
	// We will rely on errors for the rest :D force them to reauthenticate.
	static warn() {

	}
}