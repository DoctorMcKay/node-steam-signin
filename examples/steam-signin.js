const HTTP = require('http');

// Comment the next line and uncomment the following line if you aren't running this example from inside the repository
const SteamSignIn = require('../index.js');
//const SteamSignIn = require('steam-signin');

let g_ServerListenPort = null;

let server = HTTP.createServer(async (req, res) => {
	let signIn = new SteamSignIn('http://localhost');

	if (req.url.startsWith('/return')) {
		// Always return a plaintext response to this route
		res.setHeader('Content-Type', 'text/plain');

		try {
			let steamId = await signIn.verifyLogin(req.url);
			res.end(`Your SteamID is: ${steamId.getBigIntID()} / ${steamId.steam3()}`);
			console.log(`User signed in: ${steamId.getBigIntID()} / ${steamId.steam3()}`);
		} catch (ex) {
			res.end(`Failed to validate your login: ${ex.message}`);
		}

		return;
	}

	// Redirect to Steam for all routes except /return

	res.statusCode = 302;
	res.setHeader('Location', signIn.getUrl(`http://localhost:${g_ServerListenPort}/return`));
	res.end();
});

server.listen(() => {
	g_ServerListenPort = server.address().port;
	console.log(`HTTP server started. Open http://localhost:${g_ServerListenPort} in your browser to demo Steam sign-in.`);
});
