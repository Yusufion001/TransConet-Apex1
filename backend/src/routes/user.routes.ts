import { Router } from "express";
import { authenticate, type AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { z } from "zod";
import { getUserById, updateUser } from "../users/user.service.js";
import {
  updateUserSchema,
  userIdSchema,
} from "../users/user.validators.js";

const router = Router();

router.get("/:id", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = userIdSchema.parse(req.params);

    if (req.user!.id !== id && req.user!.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    const user = await getUserById(id);

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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});

router.patch("/:id", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = userIdSchema.parse(req.params);

    if (req.user!.id !== id && req.user!.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    const data = updateUserSchema.parse(req.body);

    if (
      req.user!.role === "CUSTOMER" &&
      req.user!.id === id &&
      (data.firstName !== undefined || data.lastName !== undefined)
    ) {
      return res.status(403).json({
        success: false,
        error:
          "Your verified legal name cannot be changed after customer registration.",
      });
    }

    const user = await updateUser(id, data);

    return res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});

export default router;
