import { Router } from "express";
import crypto from "node:crypto";
import { toDisputeDto } from "./dispute.dto.js";
import { z } from "zod";

import {
  createDispute,
  createTransporterDispute,
  getCustomerDisputes,
  getTransporterDisputes,
  updateDisputeStatus,
} from "./dispute.service.js";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { prisma } from "../config/prisma.js";
import { supabaseStorageService } from "../storage/supabase-storage.service.js";
import {
  disputeCreateSchema,
  disputeStatusSchema,
} from "../admin/admin.validators.js";

const router = Router();

const disputeIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const customerIdParamsSchema = z.object({
  customerId: z.string().uuid(),
});

const transporterIdParamsSchema = z.object({
  transporterId: z.string().uuid(),
});

const transporterDisputeCreateSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().trim().min(1).max(2000),
  evidence: z.object({
    media: z.array(z.object({
      type: z.enum(["IMAGE", "VIDEO"]),
      storagePath: z.string().trim().min(1),
      fileName: z.string().trim().min(1).max(255),
      mimeType: z.string().trim().min(1).max(100),
    })).max(10).optional(),
  }).optional(),
});

router.use(authenticate);

router.post("/evidence/upload-url", async (req: AuthenticatedRequest, res) => {
  try {
    const input = z.object({
      bookingId: z.string().uuid(),
      fileName: z.string().trim().min(1).max(255),
      mimeType: z.enum([
        "image/jpeg",
        "image/png",
        "image/webp",
        "video/mp4",
        "video/quicktime",
        "video/webm",
      ]),
    }).parse(req.body);

    if (req.user!.role !== "CUSTOMER" && req.user!.role !== "TRANSPORTER") {
      return res.status(403).json({
        success: false,
        error: "Only customers or transporters can upload dispute evidence",
      });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: {
        id: true,
        customerId: true,
        transporterId: true,
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Booking not found",
      });
    }

    const hasAccess =
      req.user!.role === "CUSTOMER"
        ? booking.customerId === req.user!.id
        : booking.transporterId === req.user!.id;

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    const extension = input.fileName.includes(".")
      ? input.fileName.substring(input.fileName.lastIndexOf(".")).toLowerCase()
      : "";

    const safeExtension = extension.replace(/[^a-z0-9.]/g, "");

    const storagePath =
      `${req.user!.id}/DISPUTE_EVIDENCE/${booking.id}/${crypto.randomUUID()}${safeExtension}`;

    const upload = await supabaseStorageService.createSignedUploadUrl(
      storagePath,
    );

    return res.json({
      success: true,
      data: {
        storagePath,
        signedUrl: upload.signedUrl,
        token: upload.token,
      },
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

router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.role === "TRANSPORTER") {
      const input = transporterDisputeCreateSchema.parse(req.body);

      const dispute = await createTransporterDispute({
        bookingId: input.bookingId,
        transporterId: req.user!.id,
        reason: input.reason,
        evidence: input.evidence,
      });

      return res.json({
        success: true,
        data: toDisputeDto(dispute),
      });
    }

    if (
      req.user!.role !== "CUSTOMER" &&
      req.user!.role !== "ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        error: "Only customers, transporters, or administrators can create disputes",
      });
    }

    const input =
      req.user!.role === "CUSTOMER"
        ? z.object({
            bookingId: z.string().uuid(),
            reason: z.string().trim().min(1).max(2000),
            evidence: z.object({
              media: z.array(z.object({
                type: z.enum(["IMAGE", "VIDEO"]),
                storagePath: z.string().trim().min(1),
                fileName: z.string().trim().min(1).max(255),
                mimeType: z.string().trim().min(1).max(100),
              })).max(10).optional(),
            }).optional(),
          }).parse(req.body)
        : disputeCreateSchema.parse(req.body);

    const dispute = await createDispute({
      ...input,
      customerId:
        req.user!.role === "CUSTOMER"
          ? req.user!.id
          : (input as z.infer<typeof disputeCreateSchema>).customerId,
      actorId: req.user!.id,
      evidence: input.evidence,
    });

    return res.json({
      success: true,
      data: toDisputeDto(dispute),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    const message =
      error instanceof Error ? error.message : "Server error";

    if (message === "Booking not found") {
      return res.status(404).json({
        success: false,
        error: message,
      });
    }

    if (
      message === "Access denied" ||
      message === "Invalid customer for booking" ||
      message === "Invalid transporter for booking"
    ) {
      return res.status(403).json({
        success: false,
        error: message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});

router.get(
  "/customer/:customerId",
  async (req: AuthenticatedRequest, res) => {
    try {
      const params = customerIdParamsSchema.parse(req.params);

      if (
        req.user!.role !== "ADMIN" &&
        (
          req.user!.role !== "CUSTOMER" ||
          req.user!.id !== params.customerId
        )
      ) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      const disputes = await getCustomerDisputes(
        params.customerId,
      );

      res.json({
        success: true,
        data: disputes.map(toDisputeDto),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  },
);

router.get(
  "/transporter/:transporterId",
  async (req: AuthenticatedRequest, res) => {
    try {
      const params =
        transporterIdParamsSchema.parse(req.params);

      if (
        req.user!.role !== "ADMIN" &&
        (
          req.user!.role !== "TRANSPORTER" ||
          req.user!.id !== params.transporterId
        )
      ) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      const disputes = await getTransporterDisputes(
        params.transporterId,
      );

      res.json({
        success: true,
        data: disputes.map(toDisputeDto),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  },
);

router.patch(
  "/:id/status",
  requireAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      const params = disputeIdParamsSchema.parse(req.params);
      const input = disputeStatusSchema.parse(req.body);

      const dispute = await updateDisputeStatus(
        params.id,
        input.status,
      );

      res.json({
        success: true,
        data: toDisputeDto(dispute),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  },
);

export default router;
