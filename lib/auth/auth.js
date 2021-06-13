export default class Auth {

	static TOKEN_KEY = 'discord_access_token';

	static _header() {
		return { authorization: `Bearer ${this._token()}` }
	}

	static _token() {
		let token; 
		
		const localToken = window.localStorage.getItem(this.TOKEN_KEY);
		if (localToken) token = localToken;
		console.log(localToken);

		const sessionToken = window.sessionStorage.getItem(this.TOKEN_KEY);
		if (sessionToken) token = sessionToken;
		console.log(sessionToken);

		console.log(token);

		return token;
	}

	static setToken(token, remember = true) {
		if (remember)
			window.localStorage.setItem(this.TOKEN_KEY, token);
		else
			window.sessionStorage.setItem(this.TOKEN_KEY, token);
	}


	// Show a toast the it's detected user is no authenticated/logged in...
	// We will rely on errors for the rest :D force them to reauthenticate.
	static warn() {

	}
}