import { Router } from "express";
import { getPublicTrackingByToken } from "./public-tracking.service.js";

const router = Router();

router.get("/:token", async (req, res, next) => {
  try {
    const token = req.params.token;

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tracking link",
      });
    }

    const tracking = await getPublicTrackingByToken(token);

    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: "Tracking link not found",
      });
    }

    return res.json({
      success: true,
      data: tracking,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
