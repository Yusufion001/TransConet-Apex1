import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

type ValidationTarget = "body" | "params" | "query";

export function validate(
  schema: z.ZodType,
  target: ValidationTarget = "body",
) {
  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: result.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      });
    }

    (req as Request & Record<ValidationTarget, unknown>)[target] =
      result.data;

    return next();
  };
}
