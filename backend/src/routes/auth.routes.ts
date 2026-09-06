import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { z } from "zod";
import { getUserById } from "../users/user.service.js";
import { acceptAdminInvitation } from "../admin/admin-invitation.service.js";
import {
  forgotPassword,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  resetPassword,
  resendEmailVerification,
  verifyEmail,
  sendPhoneVerificationOtp,
  resendPhoneVerificationOtp,
  verifyPhoneVerificationOtp,
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

const registerSchema = z
  .object({
    firstName: z.string().min(2).max(50),
    lastName: z.string().min(2).max(50),
    email: z.string().email(),
    phone: z.string().min(7).max(20).optional(),
    password: z.string().min(8).max(128),
    role: z.enum(["CUSTOMER", "TRANSPORTER"]),

    customerType: z.enum(["INDIVIDUAL", "BUSINESS"]).optional(),
    dateOfBirth: z.string().min(1).max(30).optional(),
    governmentIdType: z.enum(["NIN", "DRIVERS_LICENSE"]).optional(),
    governmentIdNumber: z.string().trim().min(1).max(100).optional(),
    subjectConsent: z.boolean().optional(),

    businessName: z.string().trim().min(2).max(200).optional(),
    businessAddress: z.string().trim().min(5).max(500).optional(),
    businessRegistrationNumber: z.string().trim().min(1).max(100).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.role !== "CUSTOMER") {
      return;
    }

    if (!input.customerType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customerType"],
        message: "Customer type is required",
      });
      return;
    }

    if (!input.dateOfBirth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateOfBirth"],
        message: "Date of birth is required",
      });
    }

    if (!input.governmentIdType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["governmentIdType"],
        message: "Government ID type is required",
      });
    }

    if (!input.governmentIdNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["governmentIdNumber"],
        message: "Government ID number is required",
      });
    }

    if (input.subjectConsent !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subjectConsent"],
        message: "Government ID verification consent is required",
      });
    }

    if (input.customerType === "BUSINESS") {
      if (!input.businessName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["businessName"],
          message: "Business name is required",
        });
      }

      if (!input.businessAddress) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["businessAddress"],
          message: "Business address is required",
        });
      }
    }
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
const acceptAdminInvitationSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
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

const phoneVerificationSchema = z.object({
  phoneVerificationToken: z.string().min(1),
});

const phoneOtpSchema = z.object({
  phoneVerificationToken: z.string().min(1),
  pin: z.string().regex(/^\d{6}$/, "Verification code must be 6 digits"),
});

router.post("/register", async (req, res) => {
  try {
    const input = registerSchema.parse(req.body);

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

router.post(
  "/send-phone-otp",
  emailVerificationLimiter,
  async (req, res) => {
    try {
      const input = phoneVerificationSchema.parse(req.body);

      const result = await resendPhoneVerificationOtp(
        input.phoneVerificationToken,
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

      const message =
        error instanceof Error
          ? error.message
          : "Unable to send phone verification code";

      return res.status(400).json({
        success: false,
        error: message,
      });
    }
  },
);

router.post(
  "/verify-phone-otp",
  async (req, res) => {
    try {
      const input = phoneOtpSchema.parse(req.body);

      const result = await verifyPhoneVerificationOtp(
        input.phoneVerificationToken,
        input.pin,
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

      const message =
        error instanceof Error
          ? error.message
          : "Phone verification failed";

      return res.status(400).json({
        success: false,
        error: message,
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
  "/accept-admin-invitation",
  passwordResetLimiter,
  async (req, res) => {
    try {
      const input = acceptAdminInvitationSchema.parse(req.body);

      const result = await acceptAdminInvitation(
        input.token,
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

      return res.status(400).json({
        success: false,
        error: "Administrator invitation acceptance failed",
      });
    }
  },
);

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
