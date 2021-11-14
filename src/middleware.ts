import { Request, Response, NextFunction } from "express";
import { Pool } from "pg";

//
// Make used to protect authenticated route from unauthed access
//
export function ensureUserIsLoggedIn(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ message: "Not authenticated" });
  } else {
    next();
  }
}

//
// Express handlers don't seem to accept extra params so we'll inject the DB
// pool into each request similarly to how express-session adds the user object
// into it.
//
// Closes over the db pool initialized outside during app boot
//
export function injectDBPool(pool: Pool) {
  return (req: Request, res: Response, next: NextFunction): void => {
    req.pool = pool;
    next();
  };
}
