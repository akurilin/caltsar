import { Request, Response } from "express";

// interface PostBody {
//   recurringEventId: string;
// }

export async function handlePost(
  req: Request,
  res: Response
  // next: NextFunction
): Promise<void> {
  res.status(200).json({ message: "Tracking initiated successfully" });
}

export async function handleDelete(req: Request, res: Response): Promise<void> {
  // console.log("PARAMS");
  // console.log(req.params);
  res.status(200).json({ message: "Tracking stopped" });
}
