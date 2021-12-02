import express, { Express, Request } from "express";
import expressSession from "express-session";
import pgSession from "connect-pg-simple";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import * as dotenv from "dotenv";
import * as user from "./models/user";
import { Pool } from "pg";
import passport from "passport";
import {
  Strategy as GoogleStrategy,
  VerifyCallback,
} from "passport-google-oauth2";
import { OAuth2Client } from "google-auth-library";
import { idToClient, upsertGoogleAPIClient } from "./googleapiclients";
import {
  ensureUserIsLoggedIn,
  injectDBPool,
  injectGoogleClient,
} from "./middleware";
import { getCurrentUser } from "./handlers/userhandler";
import * as Events from "./handlers/events";
import * as Trackings from "./handlers/trackings";

// declaration merging
declare global {
  /* eslint-disable @typescript-eslint/no-namespace */
  namespace Express {
    // Inject additional properties on express.Request
    interface Request {
      // ? - I'm not clear how to express the idea that the pool is not set at
      // the beginning of the request's existence until it's injected through
      // middleware without making it optional and adding a check in every
      // handler, which is laborious
      //
      pool: Pool;
      googleClient: OAuth2Client;
    }
  }
}

// initialize this to be empty
const googleAPIClients: idToClient = {};

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

//
// Configure Postgres
//

export const pool = new Pool();

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

      // find the user, create it if necessary
      const newUserParams = {
        googleId: profile.id,
        firstName: profile.name ? profile.name.givenName : "NOFIRST",
        lastName: profile.name ? profile.name.familyName : "NOLAST",
        email:
          profile.emails && profile.emails[0]
            ? profile.emails[0].value
            : "NOEMAIL",
        accessToken: accessToken,
        refreshToken: refreshToken,
      };
      user.findOrCreate(
        pool,
        newUserParams,
        (err: Error | null, userItem: user.UserEntity | null) => {
          // Assuming the user successfully gets created here if we are to
          // generate a new google API client
          if (userItem) {
            upsertGoogleAPIClient(
              pool,
              googleAPIClients,
              userItem.id,
              accessToken,
              refreshToken
            );
          }
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

//
// CORS
//
const corsOptions = {
  origin: process.env.FRONTEND_URI,
  credentials: true,
};
// Consider this as well at some point
//   res.header(
//     "Access-Control-Allow-Headers",
//     "Origin, X-Requested-With, Content-Type, Accept, Authorization"
//   );

// apply cors to ALL routes
app.use(cors(corsOptions));

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

/** Parse the request */
app.use(express.urlencoded({ extended: false }));

/** Takes care of JSON data */
app.use(express.json());
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
// app.get("/authenticated", ensureUserIsLoggedIn, (req, res) => {
//   console.log(req.user);
//   return res.status(200).json({ message: "YES, you are authenticated" });
// });

// app.get("/unauthenticated", (req, res) => {
//   if (!req.user) {
//     return res.status(200).json({ message: "YES, you are unauthenticated" });
//   } else {
//     return res.status(200).json({ message: "NO, you are not unauthenticated" });
//   }
// });

app.get("/users/me", ensureUserIsLoggedIn, getCurrentUser);

// app.get("/events", ensureUserIsLoggedIn, (req, res, next) => {
//   const thisUser = req.user as user.UserEntity;

//   if (!thisUser.refreshToken || !thisUser.accessToken) {
//     return res.status(500).json({
//       message:
//         "ERROR: looks like we didn't have Google client credentials for you",
//     });
//   } else {
//     const client = upsertGoogleAPIClient(
//       pool,
//       googleAPIClients,
//       thisUser.id,
//       thisUser.accessToken,
//       thisUser.refreshToken
//     );
//     Events.handleGet(client)(req, res, next);
//   }
// });

app.get(
  "/events",
  ensureUserIsLoggedIn,
  injectDBPool(pool),
  injectGoogleClient(googleAPIClients),
  Events.handleGet
);

app.get(
  "/trackings",
  ensureUserIsLoggedIn,
  injectDBPool(pool),
  Trackings.handleGet
);
app.post(
  "/trackings/:recurringEventId",
  ensureUserIsLoggedIn,
  injectDBPool(pool),
  injectGoogleClient(googleAPIClients),
  Trackings.handlePost
);
app.delete(
  "/trackings/:recurringEventId",
  ensureUserIsLoggedIn,
  injectDBPool(pool),
  injectGoogleClient(googleAPIClients),
  Trackings.handleDelete
);
app.get(
  "/sync",
  ensureUserIsLoggedIn,
  injectDBPool(pool),
  injectGoogleClient(googleAPIClients),
  Trackings.handleSync
);

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

export default app;
