import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncHandler = (fn: AsyncFn): RequestHandler => (req, res, next) => {
  fn(req, res, next).catch(next);
};
