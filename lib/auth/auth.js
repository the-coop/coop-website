import API from '~/lib/api/api';

export default class Auth {

	static logout() {
		window.localStorage.removeItem(this.TOKEN_KEY);
		window.sessionStorage.removeItem(this.TOKEN_KEY);
	}






	// static _token() {
	// 	let token; 
		
	// 	if (this._shouldRemember()) {
	// 		const localToken = window.localStorage.getItem(this.TOKEN_KEY);
	// 		if (localToken) token = localToken;
	// 	}

	// 	// Check for the token of a temporary session user if longer persisted data wasn't loaded/doesn't exist.
	// 	if (!token) {
	// 		const sessionToken = window.sessionStorage.getItem(this.TOKEN_KEY);
	// 		if (sessionToken) token = sessionToken;
	// 	}

	// 	return token;
	// }

	// static setToken(token) {
	// 	if (this._shouldRemember())
	// 		window.localStorage.setItem(this.TOKEN_KEY, token);
	// 	else
	// 		window.sessionStorage.setItem(this.TOKEN_KEY, token);
	// }

	static REMEMBER_ME_KEY = 'rememberme';

	// If this exists, that means they are logged in (but possibly expired) and want their data persisted.
	static _shouldRemember() {
		return window.localStorage.getItem(this.REMEMBER_ME_KEY);
	}


	// Show a toast the it's detected user is no authenticated/logged in...
	// We will rely on errors for the rest :D force them to reauthenticate.
	static warn() {

	}
}