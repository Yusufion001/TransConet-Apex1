import type { NextFunction, Request, Response } from "express";
import { recordAdminError } from "../admin/error.service.js";

function sanitizeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unknown server error";
  }

  const message = error.message.trim();

  if (!message) {
    return "Internal server error";
  }

  return message.length > 1000
    ? `${message.slice(0, 1000)}...`
    : message;
}

function getRequestUser(req: Request): {
  id?: string;
  role?: string;
} {
  const user = (req as Request & {
    user?: {
      id?: string;
      role?: string;
    };
  }).user;

  return {
    id: user?.id,
    role: user?.role,
  };
}

export async function applicationErrorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) {
    return next(err);
  }

  const user = getRequestUser(req);
  const requestId =
    typeof res.getHeader("X-Request-ID") === "string"
      ? res.getHeader("X-Request-ID")
      : undefined;

  const statusCode =
    typeof err === "object" &&
    err !== null &&
    "statusCode" in err &&
    typeof (err as { statusCode?: unknown }).statusCode === "number"
      ? (err as { statusCode: number }).statusCode
      : 500;

  const isServerError = statusCode >= 500;

  /*
   * Only unexpected/server errors are automatically persisted here.
   *
   * Ordinary client errors such as invalid input should not flood the
   * administration Error Center. Security-specific failures can later
   * be recorded explicitly by their responsible middleware/services.
   */
  if (isServerError) {
    try {
      await recordAdminError({
        eventType: "APPLICATION_ERROR",
        title: "Unhandled application error",
        description: sanitizeErrorMessage(err),
        actorId: user.id,
        entityType: "HTTP_REQUEST",
        entityId:
          typeof requestId === "string"
            ? requestId
            : undefined,
        data: {
          statusCode,
          method: req.method,
          path: req.originalUrl,
          requestId,
          userRole: user.role,
          userAgent: req.get("user-agent"),
          ipAddress: req.ip,
          errorName:
            err instanceof Error
              ? err.name
              : "UnknownError",
        },
      });
    } catch (loggingError) {
      /*
       * Error logging must never cause a second application failure.
       */
      console.error(
        "Failed to persist application error:",
        loggingError,
      );
    }
  }

  if (process.env.NODE_ENV === "production") {
    return res.status(statusCode >= 400 ? statusCode : 500).json({
      success: false,
      error:
        statusCode >= 500
          ? "Internal server error"
          : "Request failed",
      requestId,
    });
  }

  return res.status(statusCode >= 400 ? statusCode : 500).json({
    success: false,
    error:
      err instanceof Error
        ? err.message
        : "Internal server error",
    requestId,
  });
}
