import { Request, Response, NextFunction } from "express";
import { calendar_v3 } from "@googleapis/calendar";
import { UserEntity } from "../models/user";
// import { v4 as uuidv4 } from "uuid";
import { runSync } from "../models/sync";
import { resetNotifications } from "../models/notification";

//
// Run a sync and reset the user's notification channel
//
export async function handleSync(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const pool = req.pool;
  const poolClient = await pool.connect();
  const googleClient = req.googleClient;
  const calendarAPI: calendar_v3.Calendar = new calendar_v3.Calendar({
    auth: googleClient,
  });
  const user = req.user as UserEntity;

  try {
    await poolClient.query("BEGIN");

    // this is the meat
    await runSync(poolClient, calendarAPI, user);
    await resetNotifications(poolClient, calendarAPI, user);

    await poolClient.query("COMMIT");
    res.status(200).json({ message: "Completed full resync of events" });
  } catch (e) {
    await poolClient.query("ROLLBACK");
    next(e);
  } finally {
    poolClient.release();
  }
}
