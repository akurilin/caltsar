import { Request, Response, NextFunction } from "express";

// interface PostBody {
//   recurringEventId: string;
// }

// just for testing
export async function handleGet(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const queryRes = await req.pool.query("SELECT * FROM trackings");
    res.status(200).json(queryRes.rows);
  } catch (e) {
    console.log(e);
    return next(e);
    // res.status(500).json({ message: "Database error" });
  }
}

export async function handlePost(
  req: Request,
  res: Response
  // next: NextFunction
): Promise<void> {
  // console.log(req.pool);
  res
    .status(200)
    .json({ message: "TODO: IMPLEMENT ME Tracking initiated successfully" });
}

export async function handleDelete(req: Request, res: Response): Promise<void> {
  res.status(200).json({ message: "TODO: IMPLEMENT ME Tracking stopped" });
}
