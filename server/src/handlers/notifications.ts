import { Request, Response, NextFunction } from "express";
import { fetchByPushNotification } from "../models/user";
import { generateNewAPIClient } from "../googleapiclients";
import { calendar_v3 } from "@googleapis/calendar";
import { runSync } from "../models/sync";

interface PushNotification {
  channelId: string;
  resourceId: string;
  resourceState: "sync" | "exists";
  resourceURI: string;
}

// TODO: Unsafe since we're doing no validation around this
/* eslint-disable @typescript-eslint/no-explicit-any */
function headersToPushNotification(headers: any): PushNotification {
  return {
    channelId: headers["x-goog-channel-id"],
    resourceId: headers["x-goog-resource-id"],
    resourceState: headers["x-goog-resource-state"],
    resourceURI: headers["x-goog-resource-uri"],
  };
}

export async function handlePost(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // console.log("NOTIFICATIONS REQ:");
  // console.log(req.headers);
  const pool = req.pool;
  const pushNotification = headersToPushNotification(req.headers);

  if (pushNotification.resourceState == "sync") {
    // NOOP
    res.status(200).json({});
  } else if (pushNotification.resourceState == "exists") {
    const pgClient = await pool.connect();
    try {
      await pgClient.query("BEGIN");

      const user = await fetchByPushNotification(
        pgClient,
        pushNotification.channelId,
        pushNotification.resourceId
      );

      if (user) {
        const googleAPIClient = generateNewAPIClient(
          pool,
          user.id,
          user.accessToken,
          user.refreshToken
        );
        const calendarAPI: calendar_v3.Calendar = new calendar_v3.Calendar({
          auth: googleAPIClient,
        });

        // the meat of the execution
        await runSync(pgClient, calendarAPI, user);

        await pgClient.query("COMMIT");
        res.status(200).json({});
      } else {
        // I don't really love all this branching, can we linearize this?
        // It's not unsustainable for now, but it's already hard to reason about
        await pgClient.query("ROLLBACK");
        res.status(400).json({
          message: `No user found for channel ${pushNotification.channelId}`,
        });
      }
    } catch (e) {
      await pgClient.query("ROLLBACK");
      next(e);
    } finally {
      pgClient.release();
    }
  } else {
    next(Error("Not expecting a different resource state type"));
  }
}

// Sample req.headers
//
// {
//   host: 'app.akurilin.com',
//   'user-agent': 'APIs-Google; (+https://developers.google.com/webmasters/APIs-Google.html)',
//   'content-length': '0',
//   accept: '*/*',
//   'accept-encoding': 'gzip, deflate, br',
//   'x-forwarded-for': '66.102.8.79',
//   'x-forwarded-proto': 'https',
//   'x-goog-channel-expiration': 'Tue, 07 Dec 2021 08:12:36 GMT',
//   'x-goog-channel-id': '20496291-f6f8-4f36-869a-5448caa315b4',
//   'x-goog-message-number': '23533',
//   'x-goog-resource-id': 'vRdgoLIT9oMb9str2ocLU-AFVZY',
//   'x-goog-resource-state': 'exists',
//   'x-goog-resource-uri': 'https://www.googleapis.com/calendar/v3/calendars/primary/events?alt=json'
// }
