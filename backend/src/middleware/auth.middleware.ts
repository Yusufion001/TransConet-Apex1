import jwt from "jsonwebtoken";
import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

type AccessTokenPayload = {
  sub: string;
  role: string;
  type: "access";
};

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    status: string;
  };
}

function extractBearerToken(
  authorization: string | undefined,
): string | null {
  if (!authorization) {
    return null;
  }

  const match =
    /^Bearer\s+([A-Za-z0-9\-._~+/]+=*)$/i.exec(
      authorization.trim(),
    );

  return match?.[1] ?? null;
}

function verifyAccessToken(
  token: string,
): AccessTokenPayload {
  const payload = jwt.verify(
    token,
    env.JWT_ACCESS_SECRET,
  );

  if (
    typeof payload !== "object" ||
    payload === null
  ) {
    throw new Error("Invalid access token");
  }

  if (
    typeof payload.sub !== "string" ||
    payload.sub.length === 0
  ) {
    throw new Error("Invalid access token");
  }

  if (
    typeof payload.role !== "string" ||
    payload.role.length === 0
  ) {
    throw new Error("Invalid access token");
  }

  if (payload.type !== "access") {
    throw new Error("Invalid access token");
  }

  return {
    sub: payload.sub,
    role: payload.role,
    type: "access",
  };
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = extractBearerToken(
      req.headers.authorization,
    );

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const payload =
      verifyAccessToken(token);

    const user =
      await prisma.user.findUnique({
        where: {
          id: payload.sub,
        },
        select: {
          id: true,
          role: true,
          status: true,
          adminProfile: {
            select: {
              status: true,
            },
          },
        },
      });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid authentication",
      });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        error:
          user.status === "SUSPENDED"
            ? "Account suspended"
            : user.status === "BLOCKED"
              ? "Account blocked"
              : "Account is not active",
      });
    }

    /*
     * Administrator status is authoritative in AdminProfile.
     * This prevents an already-issued access token from
     * remaining usable after an administrator is suspended
     * or disabled.
     */
    if (
      user.role === "ADMIN" &&
      (!user.adminProfile || user.adminProfile.status !== "ACTIVE")
    ) {
      return res.status(403).json({
        success: false,
        error: "Administrator account is not active",
      });
    }

    /*
     * Never trust the role supplied by the JWT.
     *
     * The database remains the authoritative source
     * for the user's current role.
     */
    req.user = {
      id: user.id,
      role: user.role,
      status: user.status,
    };

    return next();
  } catch {
    return res.status(401).json({
      success: false,
      error: "Invalid token",
    });
  }
}

export function authorize(...roles: string[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    return next();
  };
}
