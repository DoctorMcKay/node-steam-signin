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

			let query = {
				'openid.assoc_handle': parsedUrl.searchParams.get('openid.assoc_handle'),
				'openid.signed': parsedUrl.searchParams.get('openid.signed'),
				'openid.sig': parsedUrl.searchParams.get('openid.sig'),
				'openid.ns': 'http://specs.openid.net/auth/2.0'
			};

			query['openid.signed'].split(',').forEach((prop) => {
				query[`openid.${prop}`] = parsedUrl.searchParams.get(`openid.${prop}`);
			});

			query['openid.mode'] = 'check_authentication';

			let returnTo = query['openid.return_to'];
			if (!returnTo) {
				return reject(new Error('No openid.return_to item is present in the URL'));
			}

			let realm = canonicalizeRealm(returnTo);
			if (realm != this._realm) {
				return reject(new Error(`Return realm "${realm}" does not match expected realm "${this._realm}"`));
			}

			let claimedIdMatch = (query['openid.claimed_id'] || '').match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)\/?$/);
			if (!claimedIdMatch) {
				return reject(new Error('No openid.claimed_id is present in the URL, or it doesn\'t have the correct format'));
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
