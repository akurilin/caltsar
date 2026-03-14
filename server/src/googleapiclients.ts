import { OAuth2Client } from "google-auth-library";
import { auth } from "@googleapis/calendar";
import { Pool } from "pg";
import * as user from "./models/user";

export interface IdToClient {
  [key: number]: OAuth2Client;
}

// creates a new Google API client and registers handlers for token refreshing
// and storing of the tokens in the db. You *MUST* handle the expiration
// messages, especially in the case of the refresh token expiring, otherwise
// you get permanently locked out of the API until the user manually intervenes
export function generateNewAPIClient(
  pool: Pool,
  userId: number,
  accessToken: string,
  refreshToken: string
): OAuth2Client {
  const client = new auth.OAuth2(
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
  //   access_token: 'ya29.EXAMPLE_ACCESS_TOKEN',
  //   refresh_token: '1//EXAMPLE_REFRESH_TOKEN',
  //   scope: 'https://www.googleapis.com/auth/calendar.events.readonly',
  //   token_type: 'Bearer',
  //   expiry_date: 1633411937822
  // }
  // NB: there's an assumption here that registering the event handler BEFORE
  // setting the credentials is ok... There's no indication of either one of
  // those directions as far as I can tell.
  client.on("tokens", (tokens) => {
    // console.log("TOKENS EVENT TRIGGERED!!!!");

    // TODO: aren't we supposed to check the result of this?
    try {
      if (tokens.refresh_token && tokens.access_token) {
        console.log("Updating Google Oauth2 access AND refresh tokens");
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
        throw new Error("No refresh token or access token given in the event");
      }
    } catch (err) {
      // Are we actually supposed to suppress this error bubbling up?
      console.error(`Could not refresh tokens for user with id ${userId}`);
    }
  });

  // update the credentials in the memory map of users just to make sure we're
  // using the latest ones at all time
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return client;
}

// create a new google api client, store the tokens with the user, register the
// client's callbacks in case tokens expire, and update the api client in-memory
// map
export function upsertGoogleAPIClient(
  pool: Pool,
  clients: IdToClient,
  userId: number,
  accessToken: string,
  refreshToken: string
): OAuth2Client {
  if (!clients[userId]) {
    clients[userId] = generateNewAPIClient(
      pool,
      userId,
      accessToken,
      refreshToken
    );
  }
  return clients[userId];
}
