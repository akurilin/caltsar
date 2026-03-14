import { Request, Response, NextFunction } from "express";
import { calendar_v3 } from "@googleapis/calendar";
import * as U from "../models/user";
import * as RE from "../models/recurring-event";
import * as E from "../models/event";

// The idea is to eliminate the google return tokens from the
// object returned from the API
export interface APIUser {
  id: number;
  googleId: string;
  firstName: string;
  lastName: string;
  email: string;
}

export async function getSelfUser(req: Request, res: Response): Promise<void> {
  const reqUser = req.user as U.UserEntity;
  const apiUser: APIUser = {
    id: reqUser.id,
    googleId: reqUser.googleId,
    firstName: reqUser.firstName,
    lastName: reqUser.lastName,
    email: reqUser.email,
  };
  res.status(200).json(apiUser);
}

export async function deleteSelfUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = req.user as U.UserEntity;
  const pool = req.pool;
  const googleClient = req.googleClient;
  const calendarAPI: calendar_v3.Calendar = new calendar_v3.Calendar({
    auth: googleClient,
  });

  const poolClient = await pool.connect();
  try {
    await poolClient.query("BEGIN");
    const recEvents = await RE.findByOrganizer(poolClient, user.googleId);
    // delete all events
    await E.deleteByRecurringEvents(poolClient, recEvents);
    // delete all recurring events
    await RE.deleteByOrganizer(poolClient, user.googleId);
    // delete the user
    await U.deleteByGoogleId(poolClient, user.googleId);
    // stop google push notifications for this user
    try {
      await calendarAPI.channels.stop({
        requestBody: {
          id: user.pushNotificationChannelId,
          resourceId: user.pushNotificationResourceId,
        },
      });
    } catch (e2) {
      // doesn't matter if this fails, it might mean the channel was already
      // expired by that point. No need to rethrow.
      console.error(e2);
    }
    // delete the passport session (keeps the actual session table row around
    // for whatever reason, and the cookie itself, although it's apparently
    // harmless, odd)
    req.logout();
    res.status(200).json({ message: "User successfully deleted" });
    await poolClient.query("COMMIT");
  } catch (e) {
    await poolClient.query("ROLLBACK");
    next(e);
  } finally {
    poolClient.release();
  }
}
