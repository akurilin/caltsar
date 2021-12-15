import express, { Express, Request } from "express";
import expressSession from "express-session";
import pgSession from "connect-pg-simple";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import { Pool } from "pg";
import passport from "passport";
import {
  Strategy as GoogleStrategy,
  VerifyCallback,
} from "passport-google-oauth2";
import passportCustom from "passport-custom";
import * as U from "./models/user";

import { OAuth2Client } from "google-auth-library";
import { IdToClient, upsertGoogleAPIClient } from "./googleapiclients";

import setUpRoutes from "./routes";

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

// TODO: this feels like an unnecessary optimization, we could be creating a new
// client on the fly on every request and scale just fine pretty much forever
// initialize this to be empty
const googleAPIClients: IdToClient = {};

// This boot-time check makes the rest of the file happy about using env vars
// that might be null
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
  !process.env.FRONTEND_URI ||
  !process.env.TEST_USER_ID
) {
  console.error("The app is missing a mandatory environment variable");
  process.exit(1);
}

//
// Configure Postgres
//

export const pool = new Pool({
  // timeout trying to get an active connection from the pool
  // usually a problem when we are leaking unclosed client connections and this
  // prevents a total deadlock
  connectionTimeoutMillis: 5000,
});

// pool.on("connect", (client) => {
//   console.log("Client connected");
// });
// pool.on("acquire", (client) => {
//   console.log("Client acquired");
// });
// pool.on("remove", (client) => {
//   console.log("Client removed");
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
      U.upsert(
        pool,
        newUserParams,
        (err: Error | null, userItem: U.UserEntity | null) => {
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

// Custom strategy for authenticating as the test user
const CustomStrategy = passportCustom.Strategy;
passport.use(
  "custom",
  new CustomStrategy(function (req: Request, callback) {
    const testUserId = process.env.TEST_USER_ID
      ? parseInt(process.env.TEST_USER_ID, 10)
      : -1;
    U.findById(pool, testUserId, (err, user) => {
      if (user) {
        callback(null, user);
      } else {
        callback(err, null);
      }
    });
  })
);

//
// Express starts here
//
const app: Express = express();

// helmet increases security by setting various HTTP headers
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
  // console.log("passport.serializeUser");
  done(null, user.id);
});

passport.deserializeUser(function (id: number, done) {
  // console.log("passport.deserializeUser");
  U.findById(pool, id, (err: Error | null, user: U.UserEntity | null) => {
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

// where all of our routes are set
setUpRoutes(app, pool, googleAPIClients);

/** Error handling */
// Has to be defined last
app.use((req, res) => {
  const error = new Error("not found");
  return res.status(404).json({
    message: error.message,
  });
});

export default app;
