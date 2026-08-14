import jwt from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const authorization =
      req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const token =
      authorization.replace(
        "Bearer ",
        "",
      );

    const payload = jwt.verify(
      token,
      env.JWT_ACCESS_SECRET,
    ) as {
      sub: string;
      role: string;
    };

    const user =
      await prisma.user.findUnique({
        where: {
          id: payload.sub,
        },
      });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "User not found",
      });
    }

    req.user = {
      id: user.id,
      role: user.role,
    };

    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: "Invalid token",
    });
  }
}
