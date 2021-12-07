import { Request, Response } from "express";

export async function handlePost(
  req: Request,
  res: Response
  // next: NextFunction
): Promise<void> {
  // TODO: let's just implement a hard sync here for now and optimize only way
  // the hell later
  console.log("NOTIFICATIONS REQ:");
  console.log(req.headers);
  // console.log(req.body);

  // x-goog-resource-state
  // if sync = nothing to do here
  // if exists = do stuff
  res.status(200).json({});
}
