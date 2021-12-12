import { Request, Response, NextFunction } from "express";
import { UserEntity } from "../models/user";

export async function handlePost(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = req.user as UserEntity;
  const pool = req.pool;
  const recurringEventId = req.params.recurringEventId;

  const poolClient = await pool.connect();
  try {
    await poolClient.query("BEGIN");
    const queryRes = await poolClient.query(
      `SELECT *
         FROM recurring_events
         WHERE google_id = $1 AND organizer_google_id = $2`,
      [recurringEventId, user.googleId]
    );
    const recEvent = queryRes.rows[0];

    // Handle all the common error cases
    if (!recEvent) {
      res.status(400).json({ message: "No such event found" });
      // } else if (event.status === "cancelled") {
      //   res.status(400).json({ message: "You cannot track a cancelled event" });
    } else {
      await poolClient.query("BEGIN");

      await poolClient.query(
        `UPDATE recurring_events
         SET tracked = true
         WHERE google_id = $1 AND organizer_google_id = $2`,
        [recurringEventId, user.googleId]
      );

      await poolClient.query("COMMIT");
      res.status(200).json({
        message: "Tracking initiated successfully",
      });
    }
  } catch (e) {
    await poolClient.query("ROLLBACK");
    next(e);
  } finally {
    poolClient.release();
  }
}

export async function handleDelete(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const pool = req.pool;
  const user = req.user as UserEntity;
  const recurringEventId = req.params.recurringEventId;
  const poolClient = await pool.connect();
  try {
    await poolClient.query("BEGIN");

    // this doesn't throw a 400 when unauthorized, it succeeds silently which
    // maybe somewhat unintuitive all things considered
    const queryRes = await poolClient.query(
      `UPDATE recurring_events
       SET tracked = false
       WHERE google_id = $1 AND organizer_google_id = $2
       RETURNING *`,
      [recurringEventId, user.googleId]
    );
    if (queryRes.rows.length == 0) {
      await poolClient.query("ROLLBACK");
      res.status(400).json({
        message:
          "No such recurring event found, or the operation is unauthorized",
      });
    } else {
      await poolClient.query("COMMIT");
      res.status(200).json({ message: "Tracking stopped" });
    }
  } catch (e) {
    await poolClient.query("ROLLBACK");
    next(e);
  } finally {
    poolClient.release();
  }
}
