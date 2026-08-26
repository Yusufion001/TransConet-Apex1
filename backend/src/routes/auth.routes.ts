import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { z } from "zod";
import { getUserById } from "../users/user.service.js";
import {
  forgotPassword,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  resetPassword,
  resendEmailVerification,
  verifyEmail,
} from "../services/auth.service.js";

const router = Router();

const emailVerificationLimiter = rateLimit({
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
      error: "Too many verification requests. Please try again later.",
    });
  },
});

const passwordResetLimiter = rateLimit({
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
      error: "Too many password reset requests. Please try again later.",
    });
  },
});

const registerSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(20).optional(),
  password: z.string().min(8).max(128),
  role: z.enum(["CUSTOMER", "TRANSPORTER"]),
});

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  identifier: z.string().min(1),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

const resendVerificationSchema = z.object({
  identifier: z.string().min(1),
});

router.post("/register", async (req, res) => {
  try {
    const input = registerSchema.parse(req.body);

    if (!input.email && !input.phone) {
      return res.status(400).json({
        success: false,
        error: "Email or phone is required",
      });
    }

    const result = await registerUser(input);

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    const message =
      error instanceof Error ? error.message : "Registration failed";

    return res.status(400).json({
      success: false,
      error: message,
    });
  }
});

router.post("/verify-email", async (req, res) => {
  try {
    const input = verifyEmailSchema.parse(req.body);
    const result = await verifyEmail(input.token);

    return res.json({
      success: true,
      data: result,
    });
  } catch {
    return res.status(400).json({
      success: false,
      error: "Invalid or expired verification token",
    });
  }
});

router.post(
  "/resend-verification",
  passwordResetLimiter,
  async (req, res) => {
    try {
      const input = resendVerificationSchema.parse(req.body);
      const result = await resendEmailVerification(input.identifier);

      return res.json({
        success: true,
        data: result,
      });
    } catch {
      return res.status(400).json({
        success: false,
        error: "Verification email request failed",
      });
    }
  },
);

router.get("/me", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await getUserById(req.user!.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    return res.json({
      success: true,
      data: user,
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: "Unable to retrieve current user",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const input = loginSchema.parse(req.body);

    const result = await loginUser(
      input.identifier,
      input.password,
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    return res.status(401).json({
      success: false,
      error: "Invalid credentials",
    });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const input = refreshSchema.parse(req.body);
    const result = await refreshAccessToken(input.refreshToken);
    return res.json({ success: true, data: result });
  } catch {
    return res.status(401).json({ success: false, error: "Invalid refresh token" });
  }
});

router.post("/logout", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await logoutUser(req.user!.id);
    return res.json({ success: true, data: result });
  } catch {
    return res.status(500).json({ success: false, error: "Logout failed" });
  }
});

router.post("/forgot-password", passwordResetLimiter, async (req, res) => {
  try {
    const input = forgotPasswordSchema.parse(req.body);

    const result = await forgotPassword(input.identifier);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Password reset request failed";

    return res.status(400).json({
      success: false,
      error: message,
    });
  }
});

router.post(
  "/reset-password",
  passwordResetLimiter,
  async (req, res) => {
  try {
    const input = resetPasswordSchema.parse(req.body);

    const result = await resetPassword(
      input.token,
      input.password,
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: "Password reset failed",
    });
  }
});
export default router;
