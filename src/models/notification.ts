import { calendar_v3 } from "@googleapis/calendar";
import { PoolClient } from "pg";
import { UserEntity } from "../models/user";
import { v4 as uuidv4 } from "uuid";
import { GaxiosError } from "gaxios";

export async function resetNotifications(
  poolClient: PoolClient,
  calendarAPI: calendar_v3.Calendar,
  user: UserEntity
): Promise<void> {
  console.log("resetNotifications");
  // wipe existing notification registration to start with a clean one
  await stopNotifications(poolClient, calendarAPI, user);

  // this would be cleaner with a RETURNING from the update but oh well
  user.pushNotificationChannelId = null;
  user.pushNotificationResourceId = null;
  user.watchingUntil = null;

  await signUpForNotifications(poolClient, calendarAPI, user);
}

export async function signUpForNotifications(
  poolClient: PoolClient,
  calendarAPI: calendar_v3.Calendar,
  user: UserEntity
): Promise<void> {
  // either we didn't have push notifications enabled for this user or the
  // push notification expired and the channel needs to be recreated
  if (
    (!user.pushNotificationChannelId && !user.pushNotificationResourceId) ||
    (user.watchingUntil && user.watchingUntil < new Date())
  ) {
    const ttlInSeconds = 1800;
    const now = new Date();

    // calculate when the push notification will expire so we can renew it
    const newWatchingUntil = new Date(now.getTime() + 1000 * ttlInSeconds);

    // We end up with a unique UUID per user (techically per primary
    // calendar), but we will be sharing the same resource id for the
    // calendar, which is always going to be "primary" in our case
    const channelId = uuidv4();
    const watchRes = await calendarAPI.events.watch({
      calendarId: "primary",
      requestBody: {
        id: channelId,
        type: "web_hook",
        // set it to 1426325213000 once we're certain we don't need channels
        // to expire quicky for debugging purposes
        params: { ttl: ttlInSeconds.toString() },
        address: "https://app.akurilin.com/notifications",
      },
    });

    if (watchRes.status != 200) {
      // we want to force a rollback here by ending up in the catch block
      console.log("RESULT OF WATCH API CALL");
      console.log(watchRes);
      throw new Error("The Google Calendar API events.watch() call failed");
    }

    // we need to watch the primary calendar only once
    // the resourceId seems to relate to the primary calendar for whose
    // events we're initializing watching, however this resource id is not
    // visible anywhere in the API, so there's no way of retrieving it
    // outside of making the .watch() call and storing it for later
    await poolClient.query(
      `UPDATE users
           SET push_notification_channel_id = $1, push_notification_resource_id = $2, watching_until = $3
           WHERE id = $4`,
      [channelId, watchRes.data.resourceId, newWatchingUntil, user.id]
    );
  }
}

// Assumes the user was obtained before the users table UPDATE below so that the
// user still contains the latest channel identifiers that we can use to stop
// notifications
export async function stopNotifications(
  poolClient: PoolClient,
  calendarAPI: calendar_v3.Calendar,
  user: UserEntity
): Promise<void> {
  await poolClient.query(
    `UPDATE users
         SET push_notification_channel_id = NULL, push_notification_resource_id = NULL, watching_until = NULL
         WHERE id = $1`,
    [user.id]
  );

  try {
    // it's possble we're repeating the delete a second time, and the channel has already been
    // stopped, so there's no point in repeating this operation since we
    // don't even track the original identifiers for the channel anymore
    // so we NOOP and proceed
    if (user.pushNotificationChannelId && user.pushNotificationResourceId) {
      await calendarAPI.channels.stop({
        requestBody: {
          id: user.pushNotificationChannelId,
          resourceId: user.pushNotificationResourceId,
        },
      });
    }
  } catch (stopError) {
    const err = stopError as GaxiosError;
    console.error(err);
    // it's possible this watching subscription has expired, so there's
    // nothing for us to stop watching on Google's end, and we can proceed
    // with the happy path
    if (err.code != "404") {
      throw stopError;
    } else {
      console.log("Gaxios resulted in a 404, but that's ok");
    }
  }
}
