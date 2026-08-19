import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  authorize,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import {
  createMarketplaceRequestSchema,
  createMarketplaceBidSchema,
  withdrawMarketplaceBidSchema,
  selectMarketplaceBidSchema,
  marketplaceVisibilityQuerySchema,
} from "./marketplace.validators.js";
import {
  createMarketplaceRequest,
  getMarketplaceRequest,
  createMarketplaceBid,
  withdrawMarketplaceBid,
  selectMarketplaceBid,
} from "./marketplace.service.js";
import { getVisibleMarketplaceLoads } from "./visibility.service.js";

const router = Router();

router.use(authenticate);


router.get(
  "/loads",
  authorize("TRANSPORTER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const query = marketplaceVisibilityQuerySchema.parse(
        req.query,
      );

      const loads = await getVisibleMarketplaceLoads(
        req.user!.id,
        query.radiusKm,
      );

      return res.json({
        success: true,
        data: loads,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid marketplace visibility query",
          details: error.issues,
        });
      }

      const message =
        error instanceof Error ? error.message : "Server error";

      if (
        message === "Transporter not found" ||
        message === "Only transporters can access marketplace visibility"
      ) {
        return res.status(403).json({
          success: false,
          error: message,
        });
      }

      if (
        message === "Transporter account is not active" ||
        message === "Transporter is not approved"
      ) {
        return res.status(403).json({
          success: false,
          error: message,
        });
      }

      if (
        message === "Invalid marketplace visibility radius" ||
        message.startsWith(
          "Marketplace visibility radius cannot exceed",
        )
      ) {
        return res.status(400).json({
          success: false,
          error: message,
        });
      }

      return res.status(500).json({
        success: false,
        error: message,
      });
    }
  },
);

router.post(
  "/requests",
  authorize("CUSTOMER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = createMarketplaceRequestSchema.parse(req.body);

      const request = await createMarketplaceRequest({
        ...input,
        customerId: req.user!.id,
      });

      return res.status(201).json({
        success: true,
        data: request,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid request data",
          details: error.issues,
        });
      }

      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

router.get(
  "/requests/:id",
  authorize("CUSTOMER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const request = await getMarketplaceRequest(
        String(req.params.id),
        req.user!.id,
      );

      if (!request) {
        return res.status(404).json({
          success: false,
          error: "Marketplace request not found",
        });
      }

      return res.json({
        success: true,
        data: request,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

router.post(
  "/requests/:id/bids",
  authorize("TRANSPORTER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = createMarketplaceBidSchema.parse(req.body);

      const bid = await createMarketplaceBid({
        ...input,
        requestId: String(req.params.id),
        transporterId: req.user!.id,
      });

      return res.status(201).json({
        success: true,
        data: bid,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid bid data",
          details: error.issues,
        });
      }

      const message =
        error instanceof Error ? error.message : "Server error";

      const conflictMessages = [
        "Marketplace request is no longer accepting bids",
        "Vehicle is not available",
        "Vehicle does not match requested truck category",
        "Transporter has already submitted a bid for this request",
      ];

      return res.status(
        conflictMessages.includes(message) ? 409 : 400,
      ).json({
        success: false,
        error: message,
      });
    }
  },
);


router.post(
  "/requests/:id/bids/:bidId/select",
  authorize("CUSTOMER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      selectMarketplaceBidSchema.parse(req.body);

      const result = await selectMarketplaceBid(
        String(req.params.id),
        String(req.params.bidId),
        req.user!.id,
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid bid selection request",
          details: error.issues,
        });
      }

      const message =
        error instanceof Error ? error.message : "Server error";

      const conflictMessages = [
        "Marketplace request is no longer accepting bid selection",
        "Marketplace request has already been processed",
        "Only pending bids can be selected",
        "Marketplace bid has expired",
        "Selected vehicle is no longer available",
        "Selected vehicle is not approved",
        "Selected vehicle no longer matches truck category",
        "Selected bid is no longer available",
      ];

      return res.status(
        conflictMessages.includes(message) ? 409 :
        message === "Access denied" ? 403 :
        message.includes("not found") ? 404 :
        400,
      ).json({
        success: false,
        error: message,
      });
    }
  },
);

router.post(
  "/bids/:id/withdraw",
  authorize("TRANSPORTER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      withdrawMarketplaceBidSchema.parse(req.body);

      const bid = await withdrawMarketplaceBid(
        String(req.params.id),
        req.user!.id,
      );

      return res.json({
        success: true,
        data: bid,
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

      return res.status(
        message === "Access denied" ? 403 : 400,
      ).json({
        success: false,
        error: message,
      });
    }
  },
);

export default router;
