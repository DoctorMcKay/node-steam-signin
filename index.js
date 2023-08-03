const HTTPS = require('https');
const QueryString = require('querystring');
const SteamID = require('steamid');

class SteamSignIn {
	/**
	 * @param {string} realm - The protocol and domain of your login server. Example: "https://example.com"
	 */
	constructor(realm) {
		this._realm = canonicalizeRealm(realm);
	}

	/**
	 * Retrieves the URL where you should redirect your user to have them authenticate through Steam.
	 *
	 * @param {string} returnUrl - The full URL they should be sent back to once they finish authenticating, including
	 *                             the protocol and host. This must match the realm you provided to the constructor.
	 *                             Example: "https://example.com/auth/login_return"
     * @return string
	 */
	getUrl(returnUrl) {
		let query = {
			'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
			'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
			'openid.mode': 'checkid_setup',
			'openid.ns': 'http://specs.openid.net/auth/2.0',
			'openid.realm': this._realm,
			'openid.return_to': returnUrl
		}

		return 'https://steamcommunity.com/openid/login?' + QueryString.stringify(query);
	}

	/**
	 * Verifies with Steam that the user has signed in successfully. Returns a Promise that resolves with their SteamID,
	 * or rejects if the login could not be verified.
	 *
	 * @param {string} url - The full URL they were sent back to from Steam, or just the path
	 * @return Promise<SteamID>
	 */
	verifyLogin(url) {
		return new Promise((resolve, reject) => {
			if (url.startsWith('/')) {
				// We really only care about the query string here
				url = 'http://example.com' + url;
			}

			let parsedUrl = new URL(url);
			let query = {};
			let passThroughParams = [
				'openid.assoc_handle',
				'openid.signed',
				'openid.sig'
			];

			// Check the response mode
			let openidMode = parsedUrl.searchParams.get('openid.mode') || '';
			if (openidMode != 'id_res') {
				return reject(new Error(`Response parameter openid.mode value "${openidMode}" does not match expected value "id_res"`));
			}

			for (let i = 0; i < passThroughParams.length; i++) {
				let param = passThroughParams[i];
				if (!parsedUrl.searchParams.has(param)) {
					return reject(new Error(`No "${param}" parameter is present in the URL`));
				}

				query[param] = parsedUrl.searchParams.get(param);
			}

			let signedParams = query['openid.signed'].split(',');
			for (let i = 0; i < signedParams.length; i++) {
				let param = `openid.${signedParams[i]}`;
				if (!parsedUrl.searchParams.has(param)) {
					return reject(new Error(`No "${param}" parameter is present in the URL`));
				}

				query[param] = parsedUrl.searchParams.get(param);
			}

			// Verify that some important parameters are signed. Steam *should* check this, but let's be doubly sure.
			let requireSigned = [
				'claimed_id',       // The user's SteamID. If not signed, the SteamID could be spoofed.
				'return_to',        // The return URL. If not signed, a login from another (malicious) site could be used.
				'response_nonce'    // The response nonce. If not signed, a successful login could be reused.
			];
			if (requireSigned.some(param => !signedParams.includes(param))) {
				return reject(new Error('A vital parameter was not signed'));
			}

			// Set these params here to avoid any potential for malicious user input overwriting them
			query = {
				...query,
				'openid.ns': 'http://specs.openid.net/auth/2.0',
				'openid.mode': 'check_authentication'
			};

			// Check openid.return_to from our query object, because it's very important that it be a signed parameter.
			let returnTo = query['openid.return_to'];
			if (!returnTo) {
				return reject(new Error('No "openid.return_to" parameter is present in the URL'));
			}

			let realm = canonicalizeRealm(returnTo);
			if (realm != this._realm) {
				return reject(new Error(`Return realm "${realm}" does not match expected realm "${this._realm}"`));
			}

			let claimedIdMatch = (query['openid.claimed_id'] || '').match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)\/?$/);
			if (!claimedIdMatch) {
				return reject(new Error('No "openid.claimed_id" parameter is present in the URL, or it doesn\'t have the correct format'));
			}

			let encodedBody = QueryString.stringify(query);
			let req = HTTPS.request({
				method: 'POST',
				protocol: 'https:',
				host: 'steamcommunity.com',
				path: '/openid/login',
				headers: {
					'content-type': 'application/x-www-form-urlencoded',
					'content-length': Buffer.byteLength(encodedBody)
				}
			}, (res) => {
				let body = '';
				res.on('data', chunk => body += chunk.toString('utf8'));
				res.on('end', () => {
					if (res.statusCode != 200) {
						return reject(new Error(`HTTP error ${res.statusCode} when validating response`));
					}

					let isValid = body.replace(/\r\n/g, '\n')
						.split('\n')
						.some(line => line == 'is_valid:true');

					if (!isValid) {
						return reject(new Error('Response was not validated by Steam. It may be forged or reused.'));
					}

					resolve(new SteamID(claimedIdMatch[1]));
				});
			});

			req.end(encodedBody);
			req.on('error', reject);
		});
	}
}

function canonicalizeRealm(realm) {
	let match = realm.match(/^(https?:\/\/[^:/]+)/);
	if (!match) {
		throw new Error(`"${realm}" does not appear to be a valid realm`);
	}

	return match[1].toLowerCase();
}

module.exports = SteamSignIn;
