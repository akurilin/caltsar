import { Request, Response, NextFunction } from "express";
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
  const reqUser = req.user as U.UserEntity;
  const pool = req.pool;
  const poolClient = await pool.connect();

  try {
    await poolClient.query("BEGIN");
    const recEvents = await RE.findByOrganizer(poolClient, reqUser.googleId);
    await E.deleteByRecurringEvents(poolClient, recEvents);
    await RE.deleteByOrganizer(poolClient, reqUser.googleId);
    await U.deleteByGoogleId(poolClient, reqUser.googleId);
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
