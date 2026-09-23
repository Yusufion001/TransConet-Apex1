import { Router } from "express";
import {
  getAdminBookingMessages,
  getAdminMessageConversations,
  sendAdminExternalCommunication,
  sendAdminMessage,
} from "./message.service.js";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import { AdminModule } from "../../generated/prisma/enums.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule(AdminModule.MESSAGING));

router.get("/", async (req, res) => {
  try {
    const search =
      typeof req.query.search === "string"
        ? req.query.search
        : undefined;

    const limit =
      typeof req.query.limit === "string"
        ? Number(req.query.limit)
        : undefined;

    const data = await getAdminMessageConversations({
      search,
      limit,
    });

    return res.json({
      success: true,
      data,
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: "Failed to load message conversations",
    });
  }
});

router.get("/:bookingId", async (req, res) => {
  try {
    const data = await getAdminBookingMessages(
      String(req.params.bookingId),
    );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load booking messages";

    const status =
      message === "Booking not found"
        ? 404
        : 500;

    return res.status(status).json({
      success: false,
      error: message,
    });
  }
});

router.post("/:bookingId/send", async (
  req: AuthenticatedRequest,
  res,
) => {
  try {
    const { recipientId, content, type } = req.body ?? {};

    const message = await sendAdminMessage({
      administratorId: req.user!.id,
      bookingId: String(req.params.bookingId),
      recipientId: String(recipientId),
      content: String(content ?? ""),
      type:
        type === "SYSTEM" || type === "SUPPORT"
          ? type
          : "TEXT",
    });

    return res.json({
      success: true,
      data: message,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to send message";

    const status =
      message === "Booking not found" ||
      message === "Recipient not found"
        ? 404
        : message === "Message content is required" ||
            message === "Message content is too long" ||
            message === "Recipient is not a participant in this shipment"
          ? 400
          : 500;

    return res.status(status).json({
      success: false,
      error: message,
    });
  }
});

router.post("/:bookingId/send-external", async (
  req: AuthenticatedRequest,
  res,
) => {
  try {
    const { recipientId, channel, content, subject } =
      req.body ?? {};

    if (channel !== "EMAIL" && channel !== "SMS") {
      return res.status(400).json({
        success: false,
        error: "Communication channel must be EMAIL or SMS",
      });
    }

    const communication =
      await sendAdminExternalCommunication({
        administratorId: req.user!.id,
        bookingId: String(req.params.bookingId),
        recipientId: String(recipientId),
        channel,
        content: String(content ?? ""),
        subject:
          typeof subject === "string"
            ? subject
            : undefined,
      });

    return res.json({
      success: true,
      data: communication,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to send communication";

    const notFound =
      message === "Booking not found" ||
      message === "Recipient not found";

    const badRequest = [
      "Message content is required",
      "Message content is too long",
      "Email subject is required",
      "SMS message is too long",
      "Recipient is not a participant in this shipment",
      "Recipient account is not active",
      "Recipient does not have an email address",
      "Recipient does not have a phone number",
      "Communication channel must be EMAIL or SMS",
    ].includes(message);

    return res.status(
      notFound ? 404 : badRequest ? 400 : 502,
    ).json({
      success: false,
      error: message,
    });
  }
});

export default router;
