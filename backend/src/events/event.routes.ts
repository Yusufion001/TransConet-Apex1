import { Router } from "express";
import {
  createShipmentEvent,
  getBookingEvents,
} from "./event.service.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const event =
      await createShipmentEvent(
        req.body,
      );

    res.json({
      success: true,
      data: event,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Server error",
    });
  }
});

router.get(
  "/booking/:bookingId",
  async (req, res) => {
    try {
      const events =
        await getBookingEvents(
          req.params.bookingId,
        );

      res.json({
        success: true,
        data: events,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Server error",
      });
    }
  },
);

export default router;
