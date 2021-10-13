import http from "http";
import express, { Express, Request } from "express";
import expressSession from "express-session";
import pgSession from "connect-pg-simple";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import * as dotenv from "dotenv";
import { auth } from "@googleapis/calendar";
import * as user from "./models/user";
import { Pool } from "pg";
import passport from "passport";
import {
  Strategy as GoogleStrategy,
  VerifyCallback,
} from "passport-google-oauth2";
import { getCurrentUser } from "./handlers/userhandler";
import { ensureUserIsLoggedIn } from "./handlers/auth";
import { getEvents } from "./handlers/events";

dotenv.config();
if (
  !process.env.PORT ||
  !process.env.CLIENT_ID ||
  !process.env.CLIENT_SECRET ||
  !process.env.NODE_ENV ||
  !process.env.PGUSER ||
  !process.env.PGHOST ||
  !process.env.PGPASSWORD ||
  !process.env.PGDATABASE ||
  !process.env.PGPORT ||
  !process.env.COOKIE_SECRET ||
  !process.env.FRONTEND_URI
) {
  console.error("The app is missing a mandatory environment variable");
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

// the pool will emit an error on behalf of any idle clients
// it contains if a backend error or network partition happens
pool.on("error", (err) => {
  console.error("Postgres Pool Error: Unexpected error on idle client", err);

  // It's not clear if crashing the server is a great idea once it's up and
  // running, but it seems like a really good idea at boot time so that we know
  // right away that something is off
  process.exit(-1);
});

//
// Configure Passport
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
      if (!profile.name || !profile.emails) {
        done(
          new Error("Cannot create account without a full name or email"),
          null
        );
      }

      console.log(`Access token:${accessToken}`);
      console.log(`Refresh token token:${refreshToken}`);
      console.log(`Passport profile:${JSON.stringify(profile)}`);

      //
      // TODO: UPSERT this operation instead?
      //
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
          accessToken: accessToken,
          refreshToken: refreshToken,
        },
        (err: Error | null, userItem: user.UserEntity | null) => {
          return done(err, userItem);
        }
      );
    }
  )
);

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

const specializedSession = pgSession(expressSession);
const sess = {
  secret: process.env.COOKIE_SECRET,

  // sameSite: true might bite us later in production if we have
  // two different subdomains, be aware of this
  cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: true }, // 30 days

  // TODO: do we want to store these sessions in the DB? Probably yes otherwise
  // people get logged out on ever app reboot?
  store: new specializedSession({ pool: pool, tableName: "sessions" }),

  resave: false,
  saveUninitialized: false,
};

// Passport defines User as {} anyway
/* eslint-disable @typescript-eslint/no-explicit-any */
passport.serializeUser(function (user: any, done) {
  console.log("passport.serializeUser");
  done(null, user.id);
});

passport.deserializeUser(function (id: number, done) {
  console.log("passport.deserializeUser");
  user.findById(pool, id, (err: Error | null, user: user.UserEntity | null) => {
    done(err, user);
  });
});

if (app.get("env") === "production") {
  app.set("trust proxy", 1); // trust first proxy
  sess.cookie.secure = true; // serve secure cookies
}

app.use(expressSession(sess));
// app.use(specializedSession(sess));

/** Parse the request */
app.use(express.urlencoded({ extended: false }));

/** Takes care of JSON data */
app.use(express.json());

// /** RULES OF OUR API */
app.use((req, res, next) => {
  // set the CORS policy
  // res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Origin", process.env.FRONTEND_URI);
  res.header("Access-Control-Allow-Credentials", "true");
  // doesn't seem necessary
  // res.header("Vary", "Origin");
  // set the CORS headers
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
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
    // tells google to send us a refresh_token so that we can keep using
    // the Google API on behalf of the user even when they're not actively in
    // the app
    accessType: "offline",
  })
);

//
// Google redirects the browser here after consent is given
//
app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    successRedirect: `${process.env.FRONTEND_URI}/dashboard`,
    failureRedirect: `${process.env.FRONTEND_URI}#failed-login`,
  })
);

// 2x test routes to test authentication
app.get("/authenticated", ensureUserIsLoggedIn, (req, res) => {
  console.log(req.user);
  return res.status(200).json({ message: "YES, you are authenticated" });
});

app.get("/unauthenticated", (req, res) => {
  if (!req.user) {
    return res.status(200).json({ message: "YES, you are unauthenticated" });
  } else {
    return res.status(200).json({ message: "NO, you are not unauthenticated" });
  }
});

app.get("/users/me", ensureUserIsLoggedIn, getCurrentUser);

app.get("/events", ensureUserIsLoggedIn, (req, res, next) => {
  const thisUser = req.user as user.UserEntity;
  if (!thisUser.refreshToken || !thisUser.accessToken) {
    return res.status(500).json({
      message:
        "ERROR: looks like we didn't have Google client credentials for you",
    });
  }

  // THOUGHTS: I'm guessing we want to build a map of clients
  // for each of our users that are in memory and active (and listening to the
  // refresh event) so that we don't have to end up with an endless pile of
  // these clients that we keep re-creating for every call
  const oneTimeClient = new auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    "http://localhost:3000/oauth2callback"
  );
  oneTimeClient.setCredentials({
    access_token: thisUser.accessToken,
    refresh_token: thisUser.refreshToken,
  });

  // The library automatically use the existing refresh token (issued only once
  // at authorization time) to refresh the access token for as long as the refresh
  // token stays valid
  // However once in a blue moon, the refresh token goes stale, and you need to
  // obtain AND STORE a new one wherever you need to
  oneTimeClient.on("tokens", (tokens) => {
    // console.log("TOKENS EVENT TRIGGERED!!!!");
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
    //
    // TODO: aren't we supposed to check the result of this?
    //
    try {
      if (tokens.refresh_token && tokens.access_token) {
        console.log("Updating Google Oauth2 refresh token");
        user.updateTokens(
          pool,
          thisUser.id,
          tokens.access_token,
          tokens.refresh_token
        );
      } else if (tokens.access_token) {
        console.log("Updating Google Oauth2 access token");
        user.updateAccessToken(pool, thisUser.id, tokens.access_token);
      } else {
        throw new Error("No refresh token or access token given in the event");
      }
    } catch (err) {
      console.error(`Could not refresh tokens for user with id ${thisUser.id}`);
    }
  });
  getEvents(oneTimeClient)(req, res, next);
});

// TODO: consider turning this into a DELETE /sessions
app.get("/auth/logout", ensureUserIsLoggedIn, (req, res) => {
  req.session.destroy(() => {
    // this is the default library name for the session cookie associated with
    // the user session in whatever store of your choosing
    // clear the cookie if the session was successfully destroyed in the store
    res.clearCookie("connect.sid");
    return res.status(200).json({});
  });
});

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
