import { Router } from "express";
import { z } from "zod";
import { getUserById, updateUser } from "../users/user.service.js";
import {
  updateUserSchema,
  userIdSchema,
} from "../users/user.validators.js";

const router = Router();

router.get("/:id", async (req, res) => {
  try {
    const { id } = userIdSchema.parse(req.params);

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

router.patch("/:id", async (req, res) => {
  try {
    const { id } = userIdSchema.parse(req.params);

    const data = updateUserSchema.parse(req.body);

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
