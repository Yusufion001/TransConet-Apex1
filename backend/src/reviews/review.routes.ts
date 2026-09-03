import { Router, type Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { createReviewSchema } from "./review.validators.js";
import { createReview, getBookingReviews } from "./review.service.js";

const router = Router();

router.use(authenticate);

function handleReviewRouteError(error: unknown, res: Response) {
  const message = error instanceof Error ? error.message : "Server error";

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: "Invalid request data",
      details: error.issues,
    });
  }

  if (
    message === "Access denied" ||
    message === "You can only review your own completed booking"
  ) {
    return res.status(403).json({
      success: false,
      error: message,
    });
  }

  if (
    message === "Booking not found" ||
    message === "Reviewee profile not found"
  ) {
    return res.status(404).json({
      success: false,
      error: message,
    });
  }

  if (
    message === "Reviews can only be submitted for completed bookings" ||
    message === "A transporter must be assigned before a booking can be reviewed" ||
    message === "You are not a participant in this booking" ||
    message === "You have already reviewed this booking"
  ) {
    return res.status(409).json({
      success: false,
      error: message,
    });
  }

  console.error("Review route error:", error);

  return res.status(500).json({
    success: false,
    error: "Server error",
  });
}

router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const input = createReviewSchema.parse(req.body);

    const review = await createReview(req.user!.id, input);

    return res.status(201).json({
      success: true,
      data: review,
    });
  } catch (error) {
    return handleReviewRouteError(error, res);
  }
});

router.get("/booking/:bookingId", async (req: AuthenticatedRequest, res) => {
  try {
    const reviews = await getBookingReviews(
      String(req.params.bookingId),
      req.user!.id,
    );

    return res.json({
      success: true,
      data: reviews,
    });
  } catch (error) {
    return handleReviewRouteError(error, res);
  }
});

export default router;
