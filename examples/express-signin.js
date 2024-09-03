// RUN: npm install express express-session
const baseUrl = "http://localhost";
const apiKey = "YOUR_STEAM_API_KEY"; // get yours here: https://steamcommunity.com/dev/apikey

const http = require("http");
const express = require("express");
const session = require("express-session");

// Comment the next line and uncomment the following line if you aren't running this example from inside the repository
const SteamSignIn = require("../index.js");
//const SteamSignIn = require('steam-signin');

const app = express();
const server = http.createServer(app);
let g_ServerListenPort;
const signIn = new SteamSignIn(baseUrl);

const personaStateMap = {
  0: "Offline",
  1: "Online",
  2: "Busy",
  3: "Away",
  4: "Snooze",
  5: "Looking to Trade",
  6: "Looking to Play",
};

// Configure session
app.use(
  session({
    secret: "AV;)KoY-M;M%~jG7}D%nFz22wr~iRU", // Set our secret key or get a random here: https://randomkeygen.com/
    resave: false,
    saveUninitialized: true,
    cookie: { secure: "auto", maxAge: 3600000 },
  })
);

//middleware
app.use((req, res, next) => {
  if (req.path === "/" || req.path.startsWith("/auth/")) {
    next(); // Skip middleware for '/' and '/auth/*' routes
  } else if (!req.session.steamId) {
    res.redirect("/");
  } else {
    next();
  }
});

app.get("/", (req, res) => {
  if (req.session.steamId) {
    res.send(`
        <p>Your SteamID is: <b>${req.session.steamId}</b></p>
        <a href="/profile">Full Profile Info - GetPlayerSummaries (v0002)</a><br/>
        <a href="/auth/logout">Log out</a>
      `);
  } else {
    res.send(`
        <a href="/auth/steam"><img src="https://community.cloudflare.steamstatic.com/public/images/signinthroughsteam/sits_01.png" width="180" height="35" border="0" alt="Sign in with Steam"></a>
      `);
  }
});

app.get("/auth/steam", (req, res) => {
  res.statusCode = 302;
  res.setHeader(
    "Location",
    signIn.getUrl(`${baseUrl}:${g_ServerListenPort}/auth/steam/callback`)
  );
  res.end();
});

app.get("/auth/steam/callback", async (req, res) => {
  res.setHeader("Content-Type", "text/plain");

  try {
    let steamId = await signIn.verifyLogin(req.url);

    // Convert the BigInt to a string before storing it in the session
    req.session.steamId = steamId.getBigIntID().toString();
    res.redirect("/");
  } catch (ex) {
    res.end(`Failed to validate your login: ${ex.message}`);
  }
});

app.get("/auth/logout", (req, res) => {
  // Destroy the session to log the user out
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      res.end("Error logging out");
    } else {
      // Redirect to the home page after logging out
      res.redirect("/");
    }
  });
});

app.get("/profile", async (req, res) => {
  const steamId = req.session.steamId;
  const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`;

  try {
    // Fetch player summary data from the Steam Web API using the native fetch API
    const response = await fetch(url);
    const data = await response.json();
    const user = data.response.players[0]; // Assuming the first player is the one we're interested in

    const personaState =
      personaStateMap[user.personastate.toString()] || "Unknown";
    const communityVisibility =
      user.communityvisibilitystate === 1 ? "Private" : "Public";

    // Construct an HTML string with the player's data
    let playerDataHtml = `
        <h1>User Profile</h1>
        <p>SteamID: ${user.steamid}</p>
        <p>Username: ${user.personaname}</p>
        <p>Profile URL: <a href="${user.profileurl}">${user.profileurl}</a></p>
        <img src="${user.avatar}" alt="Avatar" /><br>
        <img src="${user.avatarmedium}" alt="Medium Avatar" /><br>
        <img src="${user.avatarfull}" alt="Full Avatar" /><br>
        <p>Status: ${personaState}</p>
        <p>Community Visibility State: ${communityVisibility}</p>
        <p>Profile State: ${user.profilestate}</p>
        <p>Last Logoff: ${new Date(user.lastlogoff * 1000).toLocaleString()}</p>
        <p>Comment Permission: ${user.commentpermission}</p>
        <p>Real Name: ${user.realname || "Not set"}</p>
        <p>Primary Clan ID: ${user.primaryclanid}</p>
        <p>Account Creation: ${new Date(user.timecreated * 1000).toLocaleString()}</p>
        <p>Current Game ID: ${user.gameid || "Not in-game"}</p>
        <p>Game Server IP: ${user.gameserverip || "N/A"}</p>
        <p>Game Extra Info: ${user.gameextrainfo || "N/A"}</p>
        <p>Country: ${user.loccountrycode || "Not set"}</p>
        <p>State: ${user.locstatecode || "Not set"}</p>
        <p>City ID: ${user.loccityid || "Not set"}</p>
    `;

    res.send(playerDataHtml);
  } catch (error) {
    console.error("Failed to fetch player summary:", error);
    res.send("Failed to fetch player summary.");
  }
});

server.listen(() => {
  g_ServerListenPort = server.address().port;
  console.log(
    `HTTP server started. Open ${baseUrl}:${g_ServerListenPort} in your browser to demo Steam sign-in.`
  );
});
