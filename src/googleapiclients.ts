import { OAuth2Client } from "google-auth-library";
import { auth } from "@googleapis/calendar";
import { Pool } from "pg";
import * as user from "./models/user";

export interface idToClient {
  [key: number]: OAuth2Client;
}

export function upsertGoogleAPIClient(
  pool: Pool,
  clients: idToClient,
  userId: number,
  accessToken: string,
  refreshToken: string
): OAuth2Client {
  let client = clients[userId];

  if (!client) {
    // THOUGHTS: I'm guessing we want to build a map of clients
    // for each of our users that are in memory and active (and listening to the
    // refresh event) so that we don't have to end up with an endless pile of
    // these clients that we keep re-creating for every call
    client = new auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      "http://localhost:3000/oauth2callback"
    );

    // The library automatically use the existing refresh token (issued only once
    // at authorization time) to refresh the access token for as long as the refresh
    // token stays valid
    // However once in a blue moon, the refresh token goes stale, and you need to
    // obtain AND STORE a new one wherever you need to
    // a sample payload looks something like this
    //
    // {
    //   access_token: 'REDACTED_ACCESS_TOKEN_3',
    //   refresh_token: 'REDACTED_REFRESH_TOKEN_3',
    //   scope: 'https://www.googleapis.com/auth/calendar.events.readonly',
    //   token_type: 'Bearer',
    //   expiry_date: 1633411937822
    // }
    // NB: there's an assumption here that registering the event handler BEFORE
    // setting the credentials is ok... There's no indication of either one of
    // those directions as far as I can tell.
    client.on("tokens", (tokens) => {
      console.log("TOKENS EVENT TRIGGERED!!!!");

      // TODO: aren't we supposed to check the result of this?
      try {
        if (tokens.refresh_token && tokens.access_token) {
          console.log("Updating Google Oauth2 refresh token");
          user.updateTokens(
            pool,
            userId,
            tokens.access_token,
            tokens.refresh_token
          );
        } else if (tokens.access_token) {
          console.log("Updating Google Oauth2 access token");
          user.updateAccessToken(pool, userId, tokens.access_token);
        } else {
          throw new Error(
            "No refresh token or access token given in the event"
          );
        }
      } catch (err) {
        console.error(`Could not refresh tokens for user with id ${userId}`);
      }
    });

    // update the credentials in the memory map of users just to make sure we're
    // using the latest ones at all time
    client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    clients[userId] = client;
  }
  return client;
}
