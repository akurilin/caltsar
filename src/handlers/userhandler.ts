import { Request, Response } from "express";
import passport from "passport";
import {
  Strategy as GoogleStrategy,
  VerifyCallback,
} from "passport-google-oauth2";

export async function getCurrentUser(
  req: Request,
  res: Response
): Promise<void> {
  res.status(200).json(req.user);
}
