import crypto from "node:crypto";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const isProduction = process.env.NODE_ENV === "production";

function getAllowedOrigins(): string[] {
  const configured = process.env.CORS_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured && configured.length > 0) {
    return configured;
  }

  if (isProduction) {
    return [];
  }

  return [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
  ];
}

const allowedOrigins = getAllowedOrigins();

const corsOptions: cors.CorsOptions = {
  credentials: true,

  origin(origin, callback) {
    /*
     * Native Android React Native requests normally do not send
     * a browser Origin header. They are therefore allowed.
     *
     * Browser-based administrative clients must use an explicitly
     * configured origin in production.
     */
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (!isProduction) {
      return callback(null, true);
    }

    return callback(
      new Error("CORS origin not allowed"),
      false,
    );
  },

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Authorization",
    "Content-Type",
    "Accept",
    "X-Request-ID",
    "X-Idempotency-Key",
  ],

  exposedHeaders: [
    "X-Request-ID",
    "RateLimit-Limit",
    "RateLimit-Remaining",
    "RateLimit-Reset",
  ],

  maxAge: 86400,
};

const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: isProduction ? 300 : 1000,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  skip(req) {
    /*
     * Health checks should not consume API rate-limit capacity.
     */
    return (
      req.path === "/health" ||
      req.path === "/api/health"
    );
  },

  handler(_req, res) {
    res.status(429).json({
      success: false,
      error: "Too many requests. Please try again later.",
    });
  },

  keyGenerator(req) {
    /*
     * express-rate-limit already handles IPv6 normalization.
     * req.ip is also compatible with Express trust-proxy settings.
     */
    return ipKeyGenerator(req.ip ?? "unknown");
  },
});

function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const incoming = req.header("X-Request-ID");

  const requestId =
    incoming &&
    /^[A-Za-z0-9._:-]{8,128}$/.test(incoming)
      ? incoming
      : crypto.randomUUID();

  res.setHeader("X-Request-ID", requestId);

  next();
}

function securityErrorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) {
    return next(err);
  }

  const message =
    err instanceof Error ? err.message : "";

  if (message === "CORS origin not allowed") {
    return res.status(403).json({
      success: false,
      error: "Origin not allowed",
    });
  }

  /*
   * Never expose internal exception details in production.
   */
  if (isProduction) {
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }

  return res.status(500).json({
    success: false,
    error: message || "Internal server error",
  });
}

export function applySecurityFoundation(app: Express) {
  /*
   * Required when deployed behind Koyeb, Railway, Render,
   * Nginx, Cloudflare, or another reverse proxy.
   */
  app.set(
    "trust proxy",
    isProduction ? 1 : false,
  );

  /*
   * Security headers.
   */
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: {
        policy: "same-site",
      },
      referrerPolicy: {
        policy: "no-referrer",
      },
      frameguard: {
        action: "deny",
      },
      hidePoweredBy: true,
      hsts: isProduction
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
    }),
  );

  /*
   * CORS.
   */
  app.use(cors(corsOptions));

  /*
   * Browser preflight.
   */
  app.options("/{*splat}", cors(corsOptions));

  /*
   * Request identification.
   */
  app.use(requestIdMiddleware);

  /*
   * Global JSON request-size protection.
   *
   * File uploads must use dedicated multipart middleware.
   */

  app.use(
  express.json({
    limit: "1mb",
    strict: true,
    verify(req, _res, buf) {
      if (req.url === "/api/payments/webhook") {
        (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
      }
    },
  }),
);

  /*
   * Global API rate limiting.
   */
  app.use(
    "/api",
    globalApiLimiter,
  );
}

export function applySecurityErrorHandler(app: Express) {
  app.use(securityErrorMiddleware);
}
