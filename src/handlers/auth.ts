import { Request, Response, NextFunction } from "express";

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
