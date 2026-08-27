import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { calculateRoute } from "./routing.service.js";

const router = Router();

router.use(authenticate);

const routeSchema = z.object({
  origin: z.object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  }),
  destination: z.object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  }),
});

router.post(
  "/",
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = routeSchema.parse(req.body);

      const route = await calculateRoute(input.origin, input.destination);

      return res.json({
        success: true,
        data: route,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid route coordinates",
          details: error.issues,
        });
      }

      const message =
        error instanceof Error ? error.message : "Unable to calculate route";

      if (
        message === "Google Maps routing is not configured" ||
        message === "No route found"
      ) {
        return res.status(503).json({
          success: false,
          error: message,
        });
      }

      return res.status(502).json({
        success: false,
        error: "Unable to calculate route",
      });
    }
  },
);

export default router;
