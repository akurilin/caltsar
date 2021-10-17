import { Request, Response } from "express";

interface PostBody {
  recurringEventId: string;
}

export async function handlePost(
  req: Request,
  res: Response
  // next: NextFunction
): Promise<void> {
  // console.log(req);
  const body: PostBody = req.body;
  console.log(body);
  res.status(200).json({ message: "Tracking initiated successfully" });
}
