# Steam Sign-In
[![npm version](https://img.shields.io/npm/v/steam-signin.svg)](https://npmjs.com/package/steam-signin)
[![npm downloads](https://img.shields.io/npm/dm/steam-signin.svg)](https://npmjs.com/package/steam-signin)
[![license](https://img.shields.io/npm/l/steam-signin.svg)](https://github.com/DoctorMcKay/node-steam-signin/blob/master/LICENSE)
[![sponsors](https://img.shields.io/github/sponsors/DoctorMcKay.svg)](https://github.com/sponsors/DoctorMcKay)

This module provides a straightforward, secure, and non-opinionated way of authenticating Steam users in your application.

Steam provides some images you can use as buttons to direct users to Steam for authentication on their
[Steam Web API Documentation](https://steamcommunity.com/dev) overview page.

Once you have an authenticated user's SteamID, you can retrieve their public profile information using the
[ISteamUser/GetPlayerSummaries](https://developer.valvesoftware.com/wiki/Steam_Web_API#GetPlayerSummaries_.28v0002.29)
Web API method. You will need an API key, which can be obtained from that same Steam Web API Documentation page linked
above.

## Usage

The module exports a `SteamSignIn` class. Import it like so:

```js
// CommonJS
const SteamSignIn = require('steam-signin');

// ES6 Modules
import SteamSignIn from 'steam-signin';
```

Construct a new instance of `SteamSignIn`. You need to provide your realm, which is your domain and protocol (http or https).

```js
let signIn = new SteamSignIn('https://example.com');
```

Call `getUrl` to get the URL where you should redirect a user to authenticate. You need to supply a URL where the user
should be sent back to your site once they've signed in. Your return URL must match the realm you provided to the
constructor, or an Error will be thrown.

```js
let authUrl = signIn.getUrl('https://example.com/auth/return');
```

At this point, you should redirect the authenticating user to that URL. Once they return to your site, call `verifyLogin`
to retrieve their authenticated SteamID.

```js
let returnUrl = getReturnUrlSomehow();
// returnUrl must contain the URL the user landed at your site on, including all querystring parameters. How exactly you
// fetch this value will depend on the web framework you're using.

let steamId = await signIn.verifyLogin(returnUrl);
// If we make it here, the user has successfully authenticated. If their login data was bogus or reused, the verifyLogin()
// promise would reject, which you could catch with try/catch.
// steamId is a SteamID object (see https://www.npmjs.com/package/steamid)
console.log(`User successfully authenticated as ${steamId.getSteamID64()}`);
```

## Example

View a full usage example on GitHub here:
[steam-signin.js](https://github.com/DoctorMcKay/node-steam-signin/blob/master/examples/steam-signin.js)
