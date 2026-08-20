import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import {
  advertisementQuerySchema,
  advertisementResponseSchema,
} from "./marketing.dto.js";
import { getAdvertisements } from "./marketing.service.js";

const router = Router();

router.use(authenticate);

router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const query = advertisementQuerySchema.parse(req.query);

    const role = req.user?.role;

    if (role !== "CUSTOMER" && role !== "TRANSPORTER") {
      return res.status(403).json({
        success: false,
        error: "Advertisement access is only available to customers and transporters",
      });
    }

    const advertisements = await getAdvertisements(
      role,
      query.channel ?? "MOBILE_HOME",
    );

    return res.json({
      success: true,
      data: advertisements.map((advertisement) =>
        advertisementResponseSchema.parse(advertisement),
      ),
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
      error:
        error instanceof Error
          ? error.message
          : "Failed to load advertisements",
    });
  }
});

export default router;
