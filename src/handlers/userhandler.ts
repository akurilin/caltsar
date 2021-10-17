import { Request, Response } from "express";

export async function getCurrentUser(
  req: Request,
  res: Response
): Promise<void> {
  res.status(200).json(req.user);
}
