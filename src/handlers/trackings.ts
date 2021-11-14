import { Request, Response } from "express";

// interface PostBody {
//   recurringEventId: string;
// }

export async function handlePost(
  req: Request,
  res: Response
  // next: NextFunction
): Promise<void> {
  console.log(req.pool);
  res
    .status(200)
    .json({ message: "TODO: IMPLEMENT ME Tracking initiated successfully" });
}

export async function handleDelete(req: Request, res: Response): Promise<void> {
  res.status(200).json({ message: "TODO: IMPLEMENT ME Tracking stopped" });
}
