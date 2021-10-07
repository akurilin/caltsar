import http from "http";
import express, { Express, Request, Response, NextFunction } from "express";
import expressSession from "express-session";
// import pgSession from "connect-pg-simple";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import * as dotenv from "dotenv";
import { auth } from "@googleapis/calendar";
import fs from "fs";
import Event from "./event";
import user, { UserEntity } from "./user";
import { Pool } from "pg";
import passport from "passport";
import {
  Strategy as GoogleStrategy,
  VerifyCallback,
} from "passport-google-oauth2";

dotenv.config();
if (
  !process.env.PORT ||
  !process.env.CLIENT_ID ||
  !process.env.CLIENT_SECRET ||
  !process.env.COOKIE_SECRET
) {
  process.exit(1);
}
const PORT: number = parseInt(process.env.PORT as string, 10);

//
// Configure Postgres
//

const pool = new Pool();

//
// uncomment the below just to sanity check the PG connection settings
// string
//
// pool.query("SELECT NOW()", (err, res) => {
//   console.log(err, res);
//   pool.end();
// });

//
// Configure Passport
//
// Sample Google Profile:
//
// {
//   provider: 'google',
//   sub: '113738270040001178733',
//   id: '113738270040001178733',
//   displayName: 'Alexandr Kurilin',
//   name: { givenName: 'Alexandr', familyName: 'Kurilin' },
//   given_name: 'Alexandr',
//   family_name: 'Kurilin',
//   email_verified: true,
//   verified: true,
//   language: 'en',
//   locale: undefined,
//   email: 'alexandr.kurilin@gmail.com',
//   emails: [ { value: 'alexandr.kurilin@gmail.com', type: 'account' } ],
//   photos: [
//     {
//       value: 'https://lh3.googleusercontent.com/a/AATXAJwlhjEuJh-E-Ey7I27qxLRk_J_CBYkQQYxFzDXC=s96-c',
//       type: 'default'
//     }
//   ],
//   picture: 'https://lh3.googleusercontent.com/a/AATXAJwlhjEuJh-E-Ey7I27qxLRk_J_CBYkQQYxFzDXC=s96-c',
//   _raw: '{\n' +
//     '  "sub": "113738270040001178733",\n' +
//     '  "name": "Alexandr Kurilin",\n' +
//     '  "given_name": "Alexandr",\n' +
//     '  "family_name": "Kurilin",\n' +
//     '  "picture": "https://lh3.googleusercontent.com/a/AATXAJwlhjEuJh-E-Ey7I27qxLRk_J_CBYkQQYxFzDXC\\u003ds96-c",\n' +
//     '  "email": "alexandr.kurilin@gmail.com",\n' +
//     '  "email_verified": true,\n' +
//     '  "locale": "en"\n' +
//     '}',
//   _json: {
//     sub: '113738270040001178733',
//     name: 'Alexandr Kurilin',
//     given_name: 'Alexandr',
//     family_name: 'Kurilin',
//     picture: 'https://lh3.googleusercontent.com/a/AATXAJwlhjEuJh-E-Ey7I27qxLRk_J_CBYkQQYxFzDXC=s96-c',
//     email: 'alexandr.kurilin@gmail.com',
//     email_verified: true,
//     locale: 'en'
//   }
// }
// { googleId: '113738270040001178733' }
//
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/callback",
      passReqToCallback: true,
    },
    (
      request: Request,
      accessToken: string,
      refreshToken: string,
      profile: passport.Profile,
      done: VerifyCallback
    ): void => {
      // console.log("LOG: retrieving user with Google profile");
      // console.log(profile);
      // console.log("LOG: retrieving user with this request");
      // console.log(request);

      if (!profile.name || !profile.emails) {
        done(
          new Error("Cannot create account without a full name or email"),
          null
        );
      }

      // find the user, create it if necessary
      user.findOrCreate(
        pool,
        {
          googleId: profile.id,
          firstName: profile.name ? profile.name.givenName : "NOFIRST",
          lastName: profile.name ? profile.name.familyName : "NOLAST",
          email:
            profile.emails && profile.emails[0]
              ? profile.emails[0].value
              : "NOEMAIL",
        },
        (err: Error | null, userItem: UserEntity | null) => {
          return done(err, userItem);
        }
      );

      // TODO: update the google oauth client to have the access token and the
      // refresh tokens here
      //
    }
  )
);

//
// Configure Google API Oauth client and use credentials from disk for our only test user
//
const TOKEN_PATH = "dist/token.json";
const oauth2Client = new auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  "http://localhost:3000/oauth2callback"
);

// console.log(`Existing credentials:`);
// console.log(oauth2Client.credentials);

fs.readFile(TOKEN_PATH, (err, token) => {
  if (!err) {
    console.log("Token found on disk on app startup");
    console.log(`Here's the token read from disk: ${token.toString()}`);
    oauth2Client.setCredentials(JSON.parse(token.toString()));
  }
});

//
// Configure the Oauth2 client event handler
//
// The library automatically use the existing refresh token (issued only once
// at authorization time) to refresh the access token for as long as the refresh
// token stays valid
// However once in a blue moon, the refresh token goes stale, and you need to
// obtain AND STORE a new one wherever you need to
oauth2Client.on("tokens", (tokens) => {
  console.log("TOKENS EVENT TRIGGERED!!!!");
  //
  // a sample payload looks something like this
  //
  // {
  //   access_token: 'REDACTED_ACCESS_TOKEN_3',
  //   refresh_token: 'REDACTED_REFRESH_TOKEN_3',
  //   scope: 'https://www.googleapis.com/auth/calendar.events.readonly',
  //   token_type: 'Bearer',
  //   expiry_date: 1633411937822
  // }
  if (tokens.refresh_token) {
    // TODO
    // store the refresh_token in my persistence storage place
    console.log(tokens.refresh_token);
  }
  console.log(tokens.access_token);
});

//
// Express starts here
//
const app: Express = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

/** Logging */
app.use(morgan("dev"));

//
// express-session + postgres session store
//

// const specializedSession = pgSession(expressSession);
// const sess = {
//   secret: process.env.COOKIE_SECRET,
//   cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days

//   // TODO: do we want to store these sessions in the DB? Probably yes otherwise
//   // people get logged out on ever app reboot?
//   store: new specializedSession({ pool: pgPool, tableName: "sessions" }),

//   resave: false,
//   saveUninitialized: false,
// };

// Passport defines User as {} anyway
/* eslint-disable @typescript-eslint/no-explicit-any */
passport.serializeUser(function (user: any, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id: number, done) {
  user.findById(pool, id, (err: Error | null, user: UserEntity | null) => {
    done(err, user);
  });
});

const sess = {
  secret: process.env.COOKIE_SECRET,
  cookie: { secure: false }, // 30 days

  // TODO: do we want to store these sessions in the DB? Probably yes otherwise
  // people get logged out on ever app reboot?
  // store:

  resave: true,
  saveUninitialized: false,
};

if (app.get("env") === "production") {
  app.set("trust proxy", 1); // trust first proxy
  sess.cookie.secure = true; // serve secure cookies
}

app.use(expressSession(sess));

/** Parse the request */
app.use(express.urlencoded({ extended: false }));

/** Takes care of JSON data */
app.use(express.json());

/** RULES OF OUR API */
app.use((req, res, next) => {
  // set the CORS policy
  res.header("Access-Control-Allow-Origin", "*");
  // set the CORS headers
  res.header(
    "Access-Control-Allow-Headers",
    "origin, X-Requested-With,Content-Type,Accept, Authorization"
  );
  // set the CORS method headers
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", "GET PATCH DELETE POST");
    return res.status(200).json({});
  }
  next();
});

app.use(passport.initialize());
app.use(passport.session());

/** Routes */
app.get("/", (request: Request, response: Response) => {
  if (Object.keys(oauth2Client.credentials).length === 0) {
    const scopes = ["https://www.googleapis.com/auth/calendar.events.readonly"];

    // you can force the consent screen here if you really want to for some
    // reason, such as getting a refresh_token, by passing prompt: 'consent'
    // into the options below
    const url = oauth2Client.generateAuthUrl({
      // 'online' (default) or 'offline' (gets refresh_token)
      access_type: "offline",

      // If you only need one scope you can pass it as a string
      scope: scopes,
    });
    response.json({
      message: "Action: Please go to following URL to authorize the app",
      authUrl: url,
    });
  } else {
    // console.log(`Here's the token read from disk: ${token.toString()}`);
    // oauth2Client.setCredentials(JSON.parse(token.toString()));
    response.json({ message: "Success: You're already authorized." });
  }
});

//
// Browser is directed to this route from the login page
//
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: [
      "email",
      "profile",
      "https://www.googleapis.com/auth/calendar.events.readonly",
    ],
  })
);

//
// Google redirects the browser here after consent is given
//
app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    // TODO: figure out where you want to redirect people here
    successRedirect: "/auth/google/success",
    failureRedirect: "/auth/google/failure",
  })
);

// test
app.get("/authenticated", (req, res) => {
  console.log("hitting an authenticated route");
  console.log(req.session);
  return res.status(200).json({});
});
app.get("/unauthenticated", (req, res) => {
  console.log("hitting an unauthenticated route");
  return res.status(200).json({});
});

app.get("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    // this is the default library name for the session cookie associated with
    // the user session in whatever store of your choosing
    // clear the cookie if the session was successfully destroyed in the store
    res.clearCookie("connect.sid");
    return res.status(200).json({});
  });
});

app.get(
  "/oauth2callback",
  async (request: Request, response: Response, next: NextFunction) => {
    // might want to check that you actually did get the code here
    // console.log(request.query.code);

    if (!request.query.code) {
      throw new Error("Code missing from Oauth2 Callback");
    }

    const code: string = request.query.code.toString();

    // console.log(code);

    // This will provide an object with the access_token and refresh_token.
    // Save these somewhere safe so they can be used at a later time.
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    // this would eventually go in a database associated with the specific user
    fs.writeFile(TOKEN_PATH, JSON.stringify(tokens), (err) => {
      if (err) return console.error(err);
      console.log("Token stored to", TOKEN_PATH);
      next(err);
    });

    response.json({ message: "Success: Oauth2 client credentials set!" });
  }
);

app.get("/events", Event.getEvents(oauth2Client));
//app.post("/event-trackings", ...);
//app.delete("/event-trackings/:eventId", ...);

/** Error handling */
// Has to be defined last
app.use((req, res) => {
  const error = new Error("not found");
  return res.status(404).json({
    message: error.message,
  });
});

/** Server */
const httpServer = http.createServer(app);

httpServer.listen(PORT, () =>
  console.log(`The server is running on port ${PORT}`)
);
