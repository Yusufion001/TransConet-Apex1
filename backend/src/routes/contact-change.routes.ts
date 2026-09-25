import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";

import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import {
  startContactChange,
  verifyContactChangeLiveness,
  startContactChangeVerification,
  verifyContactChange,
} from "../contact-changes/contact-change.service.js";

const router = Router();

const contactChangeStartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator(req) {
    return ipKeyGenerator(req.ip ?? "unknown");
  },
  handler(_req, res) {
    return res.status(429).json({
      success: false,
      error: "Too many contact change requests. Please try again later.",
    });
  },
});

const contactChangeLivenessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator(req) {
    return ipKeyGenerator(req.ip ?? "unknown");
  },
  handler(_req, res) {
    return res.status(429).json({
      success: false,
      error: "Too many liveness verification requests. Please try again later.",
    });
  },
});

const contactVerificationStartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator(req) {
    return ipKeyGenerator(req.ip ?? "unknown");
  },
  handler(_req, res) {
    return res.status(429).json({
      success: false,
      error: "Too many contact verification requests. Please try again later.",
    });
  },
});

const contactVerificationVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator(req) {
    return ipKeyGenerator(req.ip ?? "unknown");
  },
  handler(_req, res) {
    return res.status(429).json({
      success: false,
      error: "Too many contact verification attempts. Please try again later.",
    });
  },
});

const startContactChangeSchema = z.object({
  type: z.enum(["EMAIL", "PHONE"]),
  requestedValue: z.string().trim().min(1).max(320),
  deviceCorrelationId: z.string().trim().min(1).max(200),
});

router.post(
  "/start",
  authenticate,
  contactChangeStartLimiter,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const input = startContactChangeSchema.parse(req.body);

      const result = await startContactChange({
        userId: req.user.id,
        type: input.type,
        requestedValue: input.requestedValue,
        deviceCorrelationId: input.deviceCorrelationId,
      });

      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid contact change request",
          details: error.flatten(),
        });
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unable to start contact change";

      return res.status(400).json({
        success: false,
        error: message,
      });
    }
  },
);

router.post(
  "/:contactChangeId/liveness/verify",
  authenticate,
  contactChangeLivenessLimiter,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const contactChangeId = z
        .string()
        .uuid()
        .parse(req.params.contactChangeId);

      const result = await verifyContactChangeLiveness({
        userId: req.user.id,
        contactChangeId,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid contact change ID",
        });
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unable to verify liveness";

      const statusCode =
        message === "Contact change not found"
          ? 404
          : message.includes("already") ||
              message.includes("state changed")
            ? 409
            : 400;

      return res.status(statusCode).json({
        success: false,
        error: message,
      });
    }
  },
);


router.post(
  "/:contactChangeId/contact-verification/start",
  authenticate,
  contactVerificationStartLimiter,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const contactChangeId = z
        .string()
        .uuid()
        .parse(req.params.contactChangeId);

      const result = await startContactChangeVerification({
        userId: req.user.id,
        contactChangeId,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid contact-change ID",
        });
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unable to start contact verification";

      const statusCode =
        message === "Contact change not found"
          ? 404
          : message.includes("already in progress")
            ? 409
            : 400;

      return res.status(statusCode).json({
        success: false,
        error: message,
      });
    }
  },
);

const verifyContactChangeSchema = z.object({
  verificationToken: z.string().trim().min(1).max(320),
});

router.post(
  "/:contactChangeId/contact-verification/verify",
  authenticate,
  contactVerificationVerifyLimiter,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const contactChangeId = z
        .string()
        .uuid()
        .parse(req.params.contactChangeId);

      const input = verifyContactChangeSchema.parse(req.body);

      const result = await verifyContactChange({
        userId: req.user.id,
        contactChangeId,
        verificationToken: input.verificationToken,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid contact verification request",
        });
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unable to verify contact change";

      const statusCode =
        message === "Contact verification request not found"
          ? 404
          : message.includes("already in use")
            ? 409
            : 400;

      return res.status(statusCode).json({
        success: false,
        error: message,
      });
    }
  },
);

export default router;
