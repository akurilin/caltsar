import { Express } from "express";
import { Pool } from "pg";
import passport from "passport";
import * as UserHandler from "./handlers/userhandler";
import * as Events from "./handlers/events";
import * as Trackings from "./handlers/trackings";
import * as Notifications from "./handlers/notifications";
import * as Sync from "./handlers/sync";
// import * as U from "./models/user";
import {
  ensureUserIsLoggedIn,
  injectDBPool,
  injectGoogleClient,
} from "./middleware";
import { IdToClient } from "./googleapiclients";

export default function setUpRoutes(
  app: Express,
  pool: Pool,
  googleAPIClients: IdToClient
): void {
  // AUTH
  //
  // Browser is directed to this route from the login page
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

  //
  // Google redirects the browser here after consent is given
  //
  app.get(
    "/auth/google/callback",
    passport.authenticate("google", {
      successRedirect: `${process.env.FRONTEND_URI}/`,
      failureRedirect: `${process.env.FRONTEND_URI}#failed-login`,
    })
  );

  app.get(
    "/auth/testlogin",
    passport.authenticate("custom"),
    function (req, res) {
      // the choice here is to either send the user back immediately to the UI
      // or to respond with a 200 and wait for them to do the next step
      res.redirect(`${process.env.FRONTEND_URI}/`);
      // res.status(200).json({ message: "Success!" });
    }
  );

  // USERS
  app.get("/users/me", ensureUserIsLoggedIn, UserHandler.getSelfUser);
  app.delete(
    "/users/me",
    ensureUserIsLoggedIn,
    injectDBPool(pool),
    injectGoogleClient(googleAPIClients),
    UserHandler.deleteSelfUser
  );

  // EVENTS
  app.get(
    "/events",
    ensureUserIsLoggedIn,
    injectDBPool(pool),
    Events.handleGet
  );

  // TRACKINGS
  app.post(
    "/trackings/:recurringEventId",
    ensureUserIsLoggedIn,
    injectDBPool(pool),
    Trackings.handlePost
  );
  app.delete(
    "/trackings/:recurringEventId",
    ensureUserIsLoggedIn,
    injectDBPool(pool),
    Trackings.handleDelete
  );

  // SYNC
  app.post(
    "/sync",
    ensureUserIsLoggedIn,
    injectDBPool(pool),
    injectGoogleClient(googleAPIClients),
    Sync.handleSync
  );

  // NOTIFICATIONS
  //
  // NB: this will not have the standard cookie we expect authenticated users to
  // call us with. This is an unauthed webhook call from Google with all of the
  // information being stored in the headers
  // Because this is an unauthed route, we have to be careful as far as what we
  // let the caller do with this operation, since we currently don't have a way to
  // prevent non-Google from calling into this
  app.post("/notifications", injectDBPool(pool), Notifications.handlePost);
}
