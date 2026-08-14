import { Router } from "express";

import {
  createTicket,
  getUserTickets,
  updateTicketStatus,
} from "./support.service.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const ticket =
      await createTicket(req.body);

    res.json({
      success: true,
      data: ticket,
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
  "/user/:userId",
  async (req, res) => {
    try {
      const tickets =
        await getUserTickets(
          req.params.userId,
        );

      res.json({
        success: true,
        data: tickets,
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

router.patch(
  "/:id/status",
  async (req, res) => {
    try {
      const ticket =
        await updateTicketStatus(
          req.params.id,
          req.body.status,
        );

      res.json({
        success: true,
        data: ticket,
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
