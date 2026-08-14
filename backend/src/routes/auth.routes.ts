import { Router } from "express";
import { z } from "zod";
import { loginUser, registerUser } from "../services/auth.service.js";

const router = Router();

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

export default router;
