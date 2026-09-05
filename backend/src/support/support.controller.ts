import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  assignTicket,
  getAdminTickets,
  updateAdminTicketStatus,
  type SupportPriority,
  type SupportStatus,
} from "./support.service.js";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Server error";
}

function getErrorStatus(message: string): number {
  if (message === "Support ticket not found") return 404;

  if (
    message === "Administrator profile not found" ||
    message === "Administrator account is not active" ||
    message === "Administrator is not authorized for SUPPORT_CARE"
  ) {
    return 403;
  }

  return 500;
}

export async function listAdminSupportTickets(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const tickets = await getAdminTickets({
      status: req.query.status as SupportStatus | undefined,
      priority: req.query.priority as SupportPriority | undefined,
    });

    return res.json({
      success: true,
      data: tickets,
    });
  } catch (error) {
    console.error("[Admin Support Tickets] FAILED:", error);
    const message = getErrorMessage(error);

    return res.status(getErrorStatus(message)).json({
      success: false,
      error: message,
    });
  }
}

export async function assignAdminSupportTicket(
  req: AuthenticatedRequest,
  res: Response,
) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
    });
  }

  try {
    const ticket = await assignTicket(
      String(req.params.id),
      req.body.administratorId,
      req.user.id,
    );

    return res.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    const message = getErrorMessage(error);

    return res.status(getErrorStatus(message)).json({
      success: false,
      error: message,
    });
  }
}

export async function updateAdminSupportTicketStatus(
  req: AuthenticatedRequest,
  res: Response,
) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
    });
  }

  try {
    const ticket = await updateAdminTicketStatus(
      String(req.params.id),
      req.body.status,
      req.user.id,
    );

    return res.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    const message = getErrorMessage(error);

    return res.status(getErrorStatus(message)).json({
      success: false,
      error: message,
    });
  }
}
