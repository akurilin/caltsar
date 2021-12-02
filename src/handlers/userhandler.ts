import { Request, Response } from "express";
import { UserEntity } from "../models/user";

// The idea is to eliminate the google return tokens from the
// object returned from the API
export interface APIUser {
  id: number;
  googleId: string;
  firstName: string;
  lastName: string;
  email: string;
}

export async function getCurrentUser(
  req: Request,
  res: Response
): Promise<void> {
  const reqUser = req.user as UserEntity;
  const apiUser: APIUser = {
    id: reqUser.id,
    googleId: reqUser.googleId,
    firstName: reqUser.firstName,
    lastName: reqUser.lastName,
    email: reqUser.email,
  };
  res.status(200).json(apiUser);
}
